import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

class NaviApiException implements Exception {
  const NaviApiException(this.message, {this.retryable = false});

  final String message;
  final bool retryable;

  @override
  String toString() => message;
}

class NaviApi {
  NaviApi({http.Client? client}) : _client = client ?? http.Client();

  static final _origin = Uri.parse('https://api.arcangelo.net');
  static final _imageUrlPattern = RegExp(
    r'https?://[^\s<>"\x27]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"\x27]*)?',
    caseSensitive: false,
  );
  final http.Client _client;

  Future<Map<String, dynamic>> _post(
    String endpoint,
    Map<String, Object?> body, {
    Duration timeout = const Duration(seconds: 35),
  }) async {
    try {
      final response = await _client
          .post(
            _origin.resolve(endpoint),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(body),
          )
          .timeout(timeout);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final retryable =
            response.statusCode == 408 ||
            response.statusCode == 425 ||
            response.statusCode == 429 ||
            response.statusCode >= 500;
        throw NaviApiException(
          'API request failed (${response.statusCode}).',
          retryable: retryable,
        );
      }
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      if (decoded is String) return {'response': decoded};
      throw const NaviApiException('The API returned an unreadable response.');
    } on TimeoutException {
      throw const NaviApiException(
        'The API request timed out.',
        retryable: true,
      );
    } on FormatException {
      throw const NaviApiException('The API returned an unreadable response.');
    } on NaviApiException {
      rethrow;
    } catch (_) {
      throw const NaviApiException(
        'Could not connect to the NAVI API.',
        retryable: true,
      );
    }
  }

  String _responseText(Map<String, dynamic> data) {
    for (final key in ['response', 'output', 'message']) {
      final value = data[key];
      if (value is String && value.trim().isNotEmpty) return value.trim();
    }
    final result = data['result'];
    if (result is Map && result['output'] is String) {
      return (result['output'] as String).trim();
    }
    return '';
  }

  String _taskId(Map<String, dynamic> data) {
    final id = data['taskId'] ?? data['task_id'];
    return id is String ? id : '';
  }

  Future<String> sendChat({
    required List<Map<String, String>> conversation,
    required String sessionId,
    required bool dark,
  }) async {
    final endpoint = dark ? '/navi_dark' : '/navi';
    var result = await _post(endpoint, {
      'type': 'text',
      'sessionId': sessionId,
      'conversation': conversation,
      'stream': false,
      'generate_files': false,
    });
    final taskId = _taskId(result);
    if (taskId.isNotEmpty) {
      result = await _poll(endpoint, taskId);
    }
    final answer = _responseText(result);
    if (answer.isEmpty) {
      throw const NaviApiException('NAVI returned an empty response.');
    }
    return answer;
  }

  Future<String> generateImage({
    required String prompt,
    Uint8List? editImage,
  }) async {
    final endpoint = editImage == null ? '/imagine' : '/multiEdit';
    final body = editImage == null
        ? <String, Object?>{'prompt': prompt}
        : <String, Object?>{
            'prompt': prompt,
            'image': [base64Encode(editImage)],
          };
    var result = await _post(endpoint, body);
    final taskId = _taskId(result);
    if (taskId.isNotEmpty) result = await _poll(endpoint, taskId);
    final imageUrl = _imageUrlPattern
        .firstMatch(_responseText(result))
        ?.group(0);
    if (imageUrl == null) {
      throw const NaviApiException('No image link was returned.');
    }
    return imageUrl.replaceAll(RegExp(r'[),.;]+$'), '');
  }

  Future<Uint8List> downloadImage(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http')) {
      throw const NaviApiException('The returned image link is invalid.');
    }
    try {
      final response = await _client
          .get(uri)
          .timeout(const Duration(minutes: 2));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw NaviApiException(
          'Image download failed (${response.statusCode}).',
        );
      }
      if (response.bodyBytes.length > 32 * 1024 * 1024) {
        throw const NaviApiException('The image exceeds the 32 MB limit.');
      }
      return response.bodyBytes;
    } on TimeoutException {
      throw const NaviApiException(
        'Image download timed out.',
        retryable: true,
      );
    } on NaviApiException {
      rethrow;
    } catch (_) {
      throw const NaviApiException('The generated image could not be loaded.');
    }
  }

  Future<Map<String, dynamic>> _poll(String endpoint, String taskId) async {
    final stopwatch = Stopwatch()..start();
    var failedPolls = 0;
    while (stopwatch.elapsed < const Duration(minutes: 45)) {
      final exponent = (failedPolls - 1).clamp(0, 4).toInt();
      final waitMs = failedPolls == 0
          ? 2200
          : (1500 * (1 << exponent)).clamp(1500, 15000).toInt();
      await Future<void>.delayed(Duration(milliseconds: waitMs));
      try {
        final result = await _post(endpoint, {
          'taskId': taskId,
        }, timeout: const Duration(seconds: 25));
        failedPolls = 0;
        final status = (result['status'] as String? ?? '').toLowerCase();
        if (const {
          'processing',
          'pending',
          'queued',
          'running',
        }.contains(status)) {
          continue;
        }
        if (status == 'error' || status == 'failed') {
          throw const NaviApiException('The chat task failed. Try again.');
        }
        if (result['response'] != null || result['output'] != null) {
          return result;
        }
        throw const NaviApiException('NAVI returned an unknown task state.');
      } on NaviApiException catch (error) {
        if (!error.retryable) rethrow;
        failedPolls++;
      }
    }
    throw const NaviApiException('The chat request exceeded its wait limit.');
  }

  void close() => _client.close();
}
