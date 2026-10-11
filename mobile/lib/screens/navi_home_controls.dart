part of 'navi_home.dart';

mixin _NaviHomeControls on _NaviHomeController {
  @override
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
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(7, 6, 7, 5),
      decoration: const BoxDecoration(
        color: Color(0xFF0A0506),
        border: Border(top: BorderSide(color: _line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (attachment != null) ...[
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: Image.memory(
                    attachment,
                    width: 44,
                    height: 38,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    attachmentName ?? 'REFERENCE IMAGE',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: _muted, fontSize: 10),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove attached image',
                  onPressed: onRemoveAttachment,
                  icon: const Icon(Icons.close, size: 18),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],
          TextField(
            controller: controller,
            minLines: 1,
            maxLines: maxLines,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 12,
              height: 1.2,
              color: Color(0xFFE8D1D8),
            ),
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: hint,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 9,
                vertical: 8,
              ),
              suffixIconConstraints: BoxConstraints(
                minWidth: onAttach == null ? 40 : 76,
                minHeight: 38,
              ),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (onAttach != null)
                    IconButton(
                      tooltip: 'Attach one image',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints.tightFor(
                        width: 38,
                        height: 38,
                      ),
                      onPressed: busy ? null : onAttach,
                      icon: const Icon(Icons.attach_file, size: 17),
                    ),
                  IconButton(
                    tooltip: actionLabel,
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints.tightFor(
                      width: 38,
                      height: 38,
                    ),
                    onPressed: busy ? null : () => onSend(),
                    icon: busy
                        ? const SizedBox(
                            width: 13,
                            height: 13,
                            child: CircularProgressIndicator(strokeWidth: 1.4),
                          )
                        : const Icon(Icons.send_outlined, size: 16),
                  ),
                ],
              ),
            ),
            onSubmitted: (_) => onSend(),
          ),
          const SizedBox(height: 5),
          Row(
            children: [
              if (format != null)
                _FormatSelector(value: format, onChanged: onFormatChanged!),
            ],
          ),
        ],
      ),
    );
  }
}

class _FormatSelector extends StatelessWidget {
  const _FormatSelector({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Container(
    height: 25,
    padding: const EdgeInsets.only(left: 6),
    decoration: BoxDecoration(border: Border.all(color: _line)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'FILETYPE:',
          style: TextStyle(
            color: _muted,
            fontFamily: 'monospace',
            fontSize: 8,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(width: 3),
        DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value,
            isDense: true,
            dropdownColor: const Color(0xFF160D11),
            style: const TextStyle(
              color: Color(0xFFF0CBD5),
              fontFamily: 'monospace',
              fontSize: 9,
            ),
            items: const ['glb', 'fbx', 'obj']
                .map(
                  (format) => DropdownMenuItem(
                    value: format,
                    child: Text(format.toUpperCase()),
                  ),
                )
                .toList(),
            onChanged: (next) {
              if (next != null) onChanged(next);
            },
          ),
        ),
      ],
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 28, color: const Color(0xFF9E3D5B)),
          const SizedBox(height: 13),
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'monospace',
              color: Color(0xFFDFADBC),
              fontSize: 9,
              letterSpacing: 1,
            ),
          ),
          if (detail.isNotEmpty) ...[
            const SizedBox(height: 7),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: const TextStyle(color: _muted, fontSize: 10, height: 1.4),
            ),
          ],
        ],
      ),
    ),
  );
}

class _ProgressDisplay extends StatelessWidget {
  const _ProgressDisplay({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFFDDA9B7),
              fontSize: 10,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 13),
          const LinearProgressIndicator(
            minHeight: 2,
            backgroundColor: Color(0xFF2B1720),
            color: _rose,
          ),
          const SizedBox(height: 9),
          const Text(
            'UPSTREAM TASK ACTIVE',
            style: TextStyle(color: _muted, fontSize: 8, letterSpacing: 1.1),
          ),
        ],
      ),
    ),
  );
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        SizedBox(
          width: 13,
          height: 13,
          child: CircularProgressIndicator(color: _rose, strokeWidth: 1.4),
        ),
        SizedBox(width: 10),
        Text(
          'NAVI PROCESSING',
          style: TextStyle(color: _muted, fontSize: 9, letterSpacing: 1.3),
        ),
      ],
    ),
  );
}
