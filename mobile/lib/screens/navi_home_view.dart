part of 'navi_home.dart';

mixin _NaviHomeView on _NaviHomeController {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _header(),
            _modeTabs(),
            Expanded(
              child: !_hydrated
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: _rose,
                        strokeWidth: 1.5,
                      ),
                    )
                  : IndexedStack(
                      index: _tab,
                      children: [_chatPane(), _imagePane(), _modelPane()],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _line)),
        color: Color(0xFF0A0506),
      ),
      child: Row(
        children: [
          Image.asset('assets/navi_icon.png', width: 19, height: 19),
          const SizedBox(width: 5),
          const Text(
            'NAVI',
            style: TextStyle(
              fontFamily: 'monospace',
              letterSpacing: 2,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xFFF1C6D1),
            ),
          ),
          const SizedBox(width: 9),
          Container(width: 1, height: 13, color: _line),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              '[ COMMUNICATION CONSOLE ]',
              maxLines: 1,
              overflow: TextOverflow.clip,
              style: TextStyle(
                fontFamily: 'monospace',
                color: Color(0xFFB38B97),
                fontSize: 8,
                letterSpacing: 0.4,
              ),
            ),
          ),
          if (_tab == 0) ...[
            IconButton(
              tooltip: 'New chat session',
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints.tightFor(width: 28, height: 30),
              onPressed: _newSession,
              icon: const Icon(Icons.add, color: _rose, size: 17),
            ),
            IconButton(
              tooltip: 'Choose chat session',
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints.tightFor(width: 28, height: 30),
              onPressed: _chooseSession,
              icon: const Icon(Icons.menu, size: 16),
            ),
          ],
          if (_tab == 2)
            IconButton(
              tooltip: 'Saved artifacts',
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints.tightFor(width: 32, height: 30),
              onPressed: _showArtifactList,
              icon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.inventory_2_outlined, size: 15),
                  const SizedBox(width: 2),
                  Text(
                    _artifacts.length.toString().padLeft(2, '0'),
                    style: const TextStyle(
                      color: _rose,
                      fontFamily: 'monospace',
                      fontSize: 8,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _modeTabs() {
    return Container(
      height: 31,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      decoration: const BoxDecoration(
        color: Color(0xFF10070A),
        border: Border(bottom: BorderSide(color: _line)),
      ),
      child: Row(
        children: [
          _modeTab('CHAT', 0),
          _modeTab('IMAGE', 1),
          _modeTab('3D', 2),
          const Spacer(),
          const Text(
            'CORRUPTED: OFF',
            style: TextStyle(
              color: Color(0xFFB98D99),
              fontFamily: 'monospace',
              fontSize: 7,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeTab(String label, int index) {
    final selected = _tab == index;
    return InkWell(
      onTap: () => setState(() => _tab = index),
      child: Container(
        height: 27,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: selected ? _rose : Colors.transparent,
          border: Border.all(color: selected ? _rose : Colors.transparent),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? const Color(0xFF18070D) : const Color(0xFFC09AA5),
            fontFamily: 'monospace',
            fontSize: 8,
            letterSpacing: 1,
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _chatPane() {
    final session = _currentSession;
    if (session == null) return const SizedBox.shrink();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  session.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFFDDB8C3),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SegmentedButton<bool>(
                showSelectedIcon: false,
                style: const ButtonStyle(
                  visualDensity: VisualDensity.compact,
                  textStyle: WidgetStatePropertyAll(
                    TextStyle(fontSize: 10, letterSpacing: 1),
                  ),
                ),
                segments: const [
                  ButtonSegment(value: false, label: Text('NAVI')),
                  ButtonSegment(value: true, label: Text('DARK')),
                ],
                selected: {session.dark},
                onSelectionChanged: (value) => _setDark(value.first),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFF2C1720)),
        Expanded(
          child: session.messages.isEmpty
              ? const _EmptyState(
                  icon: Icons.radio_button_checked,
                  title: 'LINK READY',
                  detail: 'Messages remain saved on this device.',
                )
              : ListView.builder(
                  controller: _chatScroll,
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                  itemCount: session.messages.length + (_chatBusy ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (_chatBusy && index == session.messages.length) {
                      return const _TypingIndicator();
                    }
                    return _messageBubble(session.messages[index]);
                  },
                ),
        ),
        _composer(
          controller: _chatInput,
          hint: 'Type your message...',
          busy: _chatBusy,
          onSend: _sendChat,
          maxLines: 5,
        ),
      ],
    );
  }

  Widget _messageBubble(NaviMessage message) {
    final user = message.role == 'user';
    return Align(
      alignment: user ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.88,
        ),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: user ? const Color(0xFF2A111A) : const Color(0xFF100B0E),
          border: Border.all(
            color: user ? const Color(0xFF8E3854) : const Color(0xFF3F2931),
          ),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              user ? 'YOU' : 'NAVI',
              style: TextStyle(
                color: user ? const Color(0xFFF09AB0) : _rose,
                fontSize: 9,
                letterSpacing: 1.8,
              ),
            ),
            const SizedBox(height: 5),
            MarkdownBody(
              data: message.content,
              selectable: true,
              styleSheet: MarkdownStyleSheet(
                p: const TextStyle(
                  fontSize: 14,
                  height: 1.45,
                  color: Color(0xFFE7D9DE),
                ),
                code: const TextStyle(color: Color(0xFFFFB3C4), fontSize: 12),
                codeblockDecoration: BoxDecoration(
                  color: const Color(0xFF080608),
                  border: Border.all(color: _line),
                  borderRadius: BorderRadius.circular(3),
                ),
                blockquoteDecoration: const BoxDecoration(
                  border: Border(left: BorderSide(color: _rose, width: 2)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imagePane() {
    return Column(
      children: [
        Expanded(
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            decoration: BoxDecoration(
              color: const Color(0xFF080709),
              border: Border.all(color: _line),
            ),
            child: _imageBusy
                ? _ProgressDisplay(
                    label: _editImageBytes == null
                        ? 'SYNTHESIZING IMAGE'
                        : 'EDITING IMAGE',
                  )
                : _imageOutputPath != null
                ? ClipRect(
                    child: Image.file(
                      File(_imageOutputPath!),
                      fit: BoxFit.contain,
                    ),
                  )
                : const _EmptyState(
                    icon: Icons.image_outlined,
                    title: 'NO IMAGE LOADED',
                    detail: 'Describe an image or attach one to edit.',
                  ),
          ),
        ),
        _composer(
          controller: _imageInput,
          hint: 'Describe an image or an edit...',
          busy: _imageBusy,
          onSend: _generateImage,
          maxLines: 4,
          attachment: _editImageBytes,
          attachmentName: _editImageName,
          onAttach: () => _pickImage(forModel: false),
          onRemoveAttachment: () => setState(() {
            _editImageBytes = null;
            _editImageName = null;
          }),
          actionLabel: _editImageBytes == null ? 'GENERATE' : 'EDIT',
        ),
      ],
    );
  }

  Widget _modelPane() {
    final active = _activeArtifact;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: _rose,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  active == null
                      ? '3D DISPLAY'
                      : '${active.name}  /  ${active.format.toUpperCase()}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    letterSpacing: 1.15,
                    color: Color(0xFFE1C7CF),
                  ),
                ),
              ),
              if (_artifacts.isNotEmpty)
                IconButton(
                  tooltip: 'Choose saved artifact',
                  visualDensity: VisualDensity.compact,
                  onPressed: _showArtifactList,
                  icon: const Icon(
                    Icons.view_list_outlined,
                    size: 19,
                    color: _rose,
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 4, 12, 10),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: const Color(0xFF080709),
              border: Border.all(color: _line),
            ),
            child: _modelBusy
                ? _ProgressDisplay(
                    label: _modelStatus.isEmpty
                        ? 'SYNTHESIZING MESH'
                        : _modelStatus,
                  )
                : active == null
                ? const _EmptyState(
                    icon: Icons.add_box_outlined,
                    title: 'NO MODEL LOADED',
                    detail: '',
                  )
                : ModelPreview(key: ValueKey(active.id), artifact: active),
          ),
        ),
        if (_modelStatus.isNotEmpty && !_modelBusy)
          Padding(
            padding: const EdgeInsets.only(bottom: 7),
            child: Text(
              _modelStatus,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: _muted,
                fontSize: 9,
                letterSpacing: 1.1,
              ),
            ),
          ),
        _composer(
          controller: _modelInput,
          hint: 'Describe a 3D model...',
          busy: _modelBusy,
          onSend: _generate3D,
          maxLines: 3,
          attachment: _modelImageBytes,
          attachmentName: _modelImageName,
          onAttach: () => _pickImage(forModel: true),
          onRemoveAttachment: () => setState(() {
            _modelImageBytes = null;
            _modelImageName = null;
            _modelImageMime = null;
          }),
          actionLabel: 'GENERATE',
          format: _modelFormat,
          onFormatChanged: (format) => setState(() => _modelFormat = format),
        ),
      ],
    );
  }
}
