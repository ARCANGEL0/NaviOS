import 'local_id.dart';

class NaviArtifact {
  const NaviArtifact({
    required this.id,
    required this.name,
    required this.prompt,
    required this.format,
    required this.localPath,
    required this.size,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String prompt;
  final String format;
  final String localPath;
  final int size;
  final DateTime createdAt;

  Map<String, Object?> toJson() => {
    'id': id,
    'name': name,
    'prompt': prompt,
    'format': format,
    'localPath': localPath,
    'size': size,
    'createdAt': createdAt.toIso8601String(),
  };

  factory NaviArtifact.fromJson(Map<String, dynamic> json) => NaviArtifact(
    id: json['id'] as String? ?? newLocalId(),
    name: json['name'] as String? ?? 'Model',
    prompt: json['prompt'] as String? ?? '',
    format: (json['format'] as String? ?? 'glb').toLowerCase(),
    localPath: json['localPath'] as String? ?? '',
    size: json['size'] as int? ?? 0,
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
  );
}
