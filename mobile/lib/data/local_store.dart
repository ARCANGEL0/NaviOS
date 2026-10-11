import 'dart:typed_data';

import '../models.dart';
import 'artifact_store.dart';
import 'image_store.dart';
import 'model_store.dart';
import 'session_store.dart';

class NaviLocalStore {
  static const maxArtifactBytes = NaviModelStore.maxArtifactBytes;

  static Future<List<NaviSession>> loadSessions() => NaviSessionStore.load();

  static Future<void> saveSessions(List<NaviSession> sessions) =>
      NaviSessionStore.save(sessions);

  static Future<List<NaviArtifact>> loadArtifacts() => NaviArtifactStore.load();

  static Future<void> saveArtifacts(List<NaviArtifact> artifacts) =>
      NaviArtifactStore.save(artifacts);

  static Future<NaviArtifact> saveModel({
    required String id,
    required String fileName,
    required String prompt,
    required String format,
    required Uint8List bytes,
  }) => NaviModelStore.save(
    id: id,
    fileName: fileName,
    prompt: prompt,
    format: format,
    bytes: bytes,
  );

  static Future<String> saveImage(
    String id,
    String extension,
    Uint8List bytes,
  ) => NaviImageStore.save(id: id, extension: extension, bytes: bytes);

  static Future<void> deleteArtifact(NaviArtifact artifact) =>
      NaviModelStore.delete(artifact);
}
