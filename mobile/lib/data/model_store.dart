import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

import '../models.dart';

class NaviModelStore {
  static const maxArtifactBytes = 60 * 1024 * 1024;

  static Future<NaviArtifact> save({
    required String id,
    required String fileName,
    required String prompt,
    required String format,
    required Uint8List bytes,
    Directory? root,
  }) async {
    if (bytes.isEmpty) throw const FileSystemException('Empty model file.');
    if (bytes.length > maxArtifactBytes) {
      throw const FileSystemException('Model exceeds the 60 MB device limit.');
    }
    final extension = format.toLowerCase().replaceFirst('.', '');
    if (!const {'glb', 'fbx', 'obj'}.contains(extension)) {
      throw const FileSystemException('Unsupported model format.');
    }
    final baseName = fileName.replaceAll('\\', '/').split('/').last;
    final dot = baseName.lastIndexOf('.');
    final stem = dot > 0 ? baseName.substring(0, dot) : baseName;
    final safeName = stem.replaceAll(RegExp(r'[^A-Za-z0-9_-]+'), '_');
    final base = root ?? await getApplicationDocumentsDirectory();
    final directory = Directory('${base.path}${Platform.pathSeparator}models');
    if (!await directory.exists()) await directory.create(recursive: true);
    final file = File(
      '${directory.path}${Platform.pathSeparator}$id-$safeName.$extension',
    );
    await file.writeAsBytes(bytes, flush: true);
    return NaviArtifact(
      id: id,
      name: safeName.isEmpty ? 'Generated model' : safeName,
      prompt: prompt,
      format: extension,
      localPath: file.path,
      size: bytes.length,
      createdAt: DateTime.now(),
    );
  }

  static Future<void> delete(NaviArtifact artifact) async {
    final file = File(artifact.localPath);
    if (await file.exists()) await file.delete();
  }
}
