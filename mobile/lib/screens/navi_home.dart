import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:image_picker/image_picker.dart';

import '../data/local_store.dart';
import '../data/navi_api.dart';
import '../models.dart';
import '../widgets/model_preview.dart';

part 'navi_home_view.dart';
part 'navi_home_controls.dart';
part 'navi_home_dialogs.dart';

const _rose = Color(0xFFEA6282);
const _muted = Color(0xFF9A858C);
const _line = Color(0xFF6F3045);

class NaviHome extends StatefulWidget {
  const NaviHome({super.key});

  @override
  State<NaviHome> createState() => _NaviHomeState();
}

abstract class _NaviHomeController extends State<NaviHome> {
  Widget _composer({
    required TextEditingController controller,
    required String hint,
    required bool busy,
    required Future<void> Function() onSend,
    required int maxLines,
    Uint8List? attachment,
    String? attachmentName,
    VoidCallback? onAttach,
    VoidCallback? onRemoveAttachment,
    String actionLabel = 'SEND',
    String? format,
    ValueChanged<String>? onFormatChanged,
  });

  Future<void> _showArtifactList();

  Future<void> _chooseSession();

  final _api = NaviApi();
  final _picker = ImagePicker();
  final _chatInput = TextEditingController();
  final _imageInput = TextEditingController();
  final _modelInput = TextEditingController();
  final _chatScroll = ScrollController();

  List<NaviSession> _sessions = [];
  List<NaviArtifact> _artifacts = [];
  String? _activeArtifactId;
  String? _imageOutputPath;
  String _modelFormat = 'glb';
  String _modelStatus = '';
  String? _editImageName;
  Uint8List? _editImageBytes;
  String? _modelImageName;
  String? _modelImageMime;
  Uint8List? _modelImageBytes;
  bool _hydrated = false;
  bool _chatBusy = false;
  bool _imageBusy = false;
  bool _modelBusy = false;
  int _tab = 0;

  NaviSession? get _currentSession {
    for (final session in _sessions) {
      if (session.id == _activeSessionId) return session;
    }
    return _sessions.isEmpty ? null : _sessions.first;
  }

  String? _activeSessionId;
  NaviArtifact? get _activeArtifact {
    for (final artifact in _artifacts) {
      if (artifact.id == _activeArtifactId) return artifact;
    }
    return _artifacts.isEmpty ? null : _artifacts.first;
  }

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  @override
  void dispose() {
    _api.close();
    _chatInput.dispose();
    _imageInput.dispose();
    _modelInput.dispose();
    _chatScroll.dispose();
    super.dispose();
  }

  Future<void> _hydrate() async {
    final sessions = await NaviLocalStore.loadSessions();
    final artifacts = await NaviLocalStore.loadArtifacts();
    if (!mounted) return;
    setState(() {
      _sessions = sessions.isEmpty ? [_makeSession()] : sessions;
      _activeSessionId = sessions.isEmpty ? null : sessions.first.id;
      _artifacts = artifacts;
      _activeArtifactId = artifacts.isEmpty ? null : artifacts.first.id;
      _hydrated = true;
    });
    if (sessions.isEmpty) await _saveSessions();
  }

  NaviSession _makeSession() => NaviSession(
    id: newLocalId(),
    title: 'New session',
    messages: const [],
    updatedAt: DateTime.now(),
  );

  Future<void> _saveSessions() => NaviLocalStore.saveSessions(_sessions);

  void _replaceCurrent(NaviSession session) {
    setState(() {
      _sessions = [session, ..._sessions.where((item) => item.id != session.id)]
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    });
    _saveSessions();
  }

  void _newSession() {
    final session = _makeSession();
    setState(() {
      _sessions = [session, ..._sessions];
      _activeSessionId = session.id;
    });
    _saveSessions();
  }

  void _setDark(bool dark) {
    final session = _currentSession;
    if (session == null || session.dark == dark) return;
    _replaceCurrent(session.copyWith(dark: dark, updatedAt: DateTime.now()));
  }

  Future<void> _sendChat() async {
    final prompt = _chatInput.text.trim();
    final session = _currentSession;
    if (prompt.isEmpty || session == null || _chatBusy) return;
    _chatInput.clear();
    final userMessage = NaviMessage(
      id: newLocalId(),
      role: 'user',
      content: prompt,
      createdAt: DateTime.now(),
    );
    final updated = session.copyWith(
      title: session.messages.isEmpty
          ? (prompt.length > 36 ? prompt.substring(0, 36) : prompt)
          : session.title,
      messages: [...session.messages, userMessage],
      updatedAt: DateTime.now(),
    );
    _replaceCurrent(updated);
    setState(() => _chatBusy = true);
    _scrollChatDown();
    try {
      final conversation = updated.messages
          .take(40)
          .map((message) => {'role': message.role, 'content': message.content})
          .toList();
      final answer = await _api.sendChat(
        conversation: conversation,
        sessionId: session.id,
        dark: session.dark,
      );
      final current = _sessions.firstWhere((item) => item.id == session.id);
      _replaceCurrent(
        current.copyWith(
          messages: [
            ...current.messages,
            NaviMessage(
              id: newLocalId(),
              role: 'assistant',
              content: answer,
              createdAt: DateTime.now(),
            ),
          ],
          updatedAt: DateTime.now(),
        ),
      );
    } catch (_) {
      final current = _sessions.firstWhere((item) => item.id == session.id);
      _replaceCurrent(
        current.copyWith(
          messages: [
            ...current.messages,
            NaviMessage(
              id: newLocalId(),
              role: 'assistant',
              content:
                  'NAVI // LINK LOST\n\nThe request did not complete. Check the connection and retry.',
              createdAt: DateTime.now(),
            ),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _chatBusy = false);
      _scrollChatDown();
    }
  }

  void _scrollChatDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) {
        _chatScroll.animateTo(
          _chatScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _pickImage({required bool forModel}) async {
    try {
      final picked = await _picker.pickImage(source: ImageSource.gallery);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      if (bytes.length > 32 * 1024 * 1024) {
        _notice('IMAGE EXCEEDS THE 32 MB INPUT LIMIT.');
        return;
      }
      final extension = picked.name.split('.').last.toLowerCase();
      final mime = switch (extension) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        _ => 'image/jpeg',
      };
      setState(() {
        if (forModel) {
          _modelImageBytes = bytes;
          _modelImageName = picked.name;
          _modelImageMime = mime;
        } else {
          _editImageBytes = bytes;
          _editImageName = picked.name;
        }
      });
    } catch (_) {
      _notice('IMAGE COULD NOT BE OPENED.');
    }
  }

  Future<void> _generateImage() async {
    final prompt = _imageInput.text.trim();
    if (prompt.isEmpty || _imageBusy) return;
    setState(() => _imageBusy = true);
    try {
      final url = await _api.generateImage(
        prompt: prompt,
        editImage: _editImageBytes,
      );
      final bytes = await _api.downloadImage(url);
      final extension = (Uri.tryParse(url)?.path.split('.').last ?? 'png')
          .split('/')
          .first
          .toLowerCase();
      final safeExtension =
          {'jpg', 'jpeg', 'png', 'webp', 'gif'}.contains(extension)
          ? extension
          : 'png';
      final path = await NaviLocalStore.saveImage(
        newLocalId(),
        safeExtension,
        bytes,
      );
      if (!mounted) return;
      setState(() {
        _imageOutputPath = path;
        _editImageBytes = null;
        _editImageName = null;
      });
    } catch (_) {
      _notice('IMAGE GENERATION FAILED. CHECK THE CONNECTION AND RETRY.');
    } finally {
      if (mounted) setState(() => _imageBusy = false);
    }
  }

  Future<void> _generate3D() async {
    final prompt = _modelInput.text.trim();
    if ((_modelImageBytes == null && prompt.isEmpty) || _modelBusy) return;
    setState(() {
      _modelBusy = true;
      _modelStatus = 'TRANSMITTING REQUEST';
    });
    try {
      final result = await _api.generate3D(
        prompt: prompt,
        format: _modelFormat,
        image: _modelImageBytes,
        imageMime: _modelImageMime ?? 'image/jpeg',
        onWaiting: () {
          if (mounted) setState(() => _modelStatus = 'SYNTHESIZING MESH');
        },
      );
      if (result['status'] != true) {
        throw const NaviApiException('3D generation failed.');
      }
      final url = result['file'];
      if (url is! String || url.isEmpty) {
        throw const NaviApiException('The model file was not returned.');
      }
      final resultFormat = (result['filetype'] as String? ?? _modelFormat)
          .toLowerCase();
      if (!const {'glb', 'fbx', 'obj'}.contains(resultFormat)) {
        throw const NaviApiException(
          'The API returned an unsupported model format.',
        );
      }
      setState(() => _modelStatus = 'RECEIVING MODEL FILE');
      final bytes = await _api.downloadFile(
        url,
        maxBytes: NaviLocalStore.maxArtifactBytes,
      );
      final id = newLocalId();
      final urlSegments = Uri.tryParse(url)?.pathSegments ?? const <String>[];
      final fileName = urlSegments.isEmpty
          ? 'model.$_modelFormat'
          : urlSegments.last;
      final artifact = await NaviLocalStore.saveModel(
        id: id,
        fileName: fileName,
        prompt: prompt.isNotEmpty
            ? prompt
            : 'Image to 3D: ${_modelImageName ?? 'reference image'}',
        format: resultFormat,
        bytes: bytes,
      );
      final next = [artifact, ..._artifacts];
      setState(() {
        _artifacts = next;
        _activeArtifactId = artifact.id;
        _modelStatus = 'SAVED TO THIS DEVICE';
        _modelImageBytes = null;
        _modelImageName = null;
        _modelImageMime = null;
        _modelInput.clear();
      });
      await NaviLocalStore.saveArtifacts(next);
    } catch (error) {
      final message = error is NaviApiException
          ? error.message
          : 'The model could not be saved on this device.';
      if (mounted) setState(() => _modelStatus = message.toUpperCase());
    } finally {
      if (mounted) setState(() => _modelBusy = false);
    }
  }

  void _notice(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message, style: const TextStyle(letterSpacing: 0.7)),
          backgroundColor: const Color(0xFF381522),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }
}

class _NaviHomeState extends _NaviHomeController
    with _NaviHomeView, _NaviHomeControls, _NaviHomeDialogs {}
