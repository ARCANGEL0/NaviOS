part of 'navi_home.dart';

mixin _NaviHomeDialogs on _NaviHomeController {
  @override
  Future<void> _showArtifactList() async {
    if (_artifacts.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF10090C),
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView.separated(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          itemCount: _artifacts.length,
          separatorBuilder: (_, _) => const Divider(color: _line, height: 1),
          itemBuilder: (context, index) {
            final artifact = _artifacts[index];
            return ListTile(
              leading: Text(
                (index + 1).toString().padLeft(2, '0'),
                style: const TextStyle(color: _rose, fontSize: 11),
              ),
              title: Text(
                artifact.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${artifact.format.toUpperCase()}  /  ${_formatBytes(artifact.size)}',
                style: const TextStyle(
                  color: _muted,
                  fontSize: 10,
                  letterSpacing: 1,
                ),
              ),
              selected: artifact.id == _activeArtifactId,
              selectedTileColor: _rose.withValues(alpha: 0.08),
              trailing: IconButton(
                tooltip: 'Delete local artifact',
                icon: const Icon(Icons.delete_outline, size: 19),
                onPressed: () async {
                  await NaviLocalStore.deleteArtifact(artifact);
                  final next = _artifacts
                      .where((item) => item.id != artifact.id)
                      .toList();
                  if (!mounted) return;
                  setState(() {
                    _artifacts = next;
                    if (_activeArtifactId == artifact.id) {
                      _activeArtifactId = next.isEmpty ? null : next.first.id;
                    }
                  });
                  await NaviLocalStore.saveArtifacts(next);
                  if (context.mounted) Navigator.pop(context);
                },
              ),
              onTap: () {
                setState(() => _activeArtifactId = artifact.id);
                Navigator.pop(context);
              },
            );
          },
        ),
      ),
    );
  }

  @override
  Future<void> _chooseSession() async {
    if (_sessions.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF10090C),
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: _sessions.length,
          itemBuilder: (context, index) {
            final session = _sessions[index];
            return ListTile(
              title: Text(
                session.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${session.messages.length} messages',
                style: const TextStyle(color: _muted, fontSize: 11),
              ),
              trailing: session.id == _activeSessionId
                  ? const Icon(Icons.check, color: _rose)
                  : null,
              onTap: () {
                setState(() => _activeSessionId = session.id);
                Navigator.pop(context);
              },
            );
          },
        ),
      ),
    );
  }
}

String _formatBytes(int bytes) {
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
