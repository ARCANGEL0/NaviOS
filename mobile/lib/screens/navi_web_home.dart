import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

class NaviWebHome extends StatefulWidget {
  const NaviWebHome({super.key});

  @override
  State<NaviWebHome> createState() => _NaviWebHomeState();
}

class _NaviWebHomeState extends State<NaviWebHome> {
  static final _siteUri = WebUri('https://navi.arcangelo.net');

  InAppWebViewController? _controller;

  Future<void> _goBack() async {
    final controller = _controller;
    if (controller != null && await controller.canGoBack()) {
      await controller.goBack();
      return;
    }
    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goBack();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF090608),
        body: SafeArea(
          top: false,
          bottom: false,
          child: InAppWebView(
            initialUrlRequest: URLRequest(url: _siteUri),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              domStorageEnabled: true,
              databaseEnabled: true,
              supportZoom: false,
              useWideViewPort: true,
              loadWithOverviewMode: false,
              mediaPlaybackRequiresUserGesture: true,
              allowsInlineMediaPlayback: true,
            ),
            onWebViewCreated: (controller) => _controller = controller,
          ),
        ),
      ),
    );
  }
}
