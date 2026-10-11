import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

class NaviImageStore {
  static Future<String> save({
    required String id,
    required String extension,
    required Uint8List bytes,
    Directory? root,
  }) async {
    if (bytes.isEmpty) throw const FileSystemException('Empty image file.');
    final safeExtension = extension.toLowerCase().replaceFirst('.', '');
    if (!const {'jpg', 'jpeg', 'png', 'webp', 'gif'}.contains(safeExtension)) {
      throw const FileSystemException('Unsupported image format.');
    }
    final base = root ?? await getApplicationDocumentsDirectory();
    final directory = Directory('${base.path}${Platform.pathSeparator}images');
    if (!await directory.exists()) await directory.create(recursive: true);
    final safeId = id.replaceAll(RegExp(r'[^A-Za-z0-9_-]+'), '_');
    final file = File(
      '${directory.path}${Platform.pathSeparator}$safeId.$safeExtension',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }
}
