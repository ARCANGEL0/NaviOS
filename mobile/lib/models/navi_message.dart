import 'local_id.dart';

class NaviMessage {
  const NaviMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String role;
  final String content;
  final DateTime createdAt;

  Map<String, Object?> toJson() => {
    'id': id,
    'role': role,
    'content': content,
    'createdAt': createdAt.toIso8601String(),
  };

  factory NaviMessage.fromJson(Map<String, dynamic> json) => NaviMessage(
    id: json['id'] as String? ?? newLocalId(),
    role: json['role'] as String? ?? 'assistant',
    content: json['content'] as String? ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
  );
}
