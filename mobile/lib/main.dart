import 'package:flutter/material.dart';

void main() {
  runApp(const NaviMobileApp());
}

class NaviMobileApp extends StatelessWidget {
  const NaviMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NAVI',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Color(0xFF090608),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset('assets/navi_icon.png', width: 112, height: 112),
              const SizedBox(height: 18),
              const Text(
                'NAVI',
                style: TextStyle(
                  color: Color(0xFFEA6282),
                  fontFamily: 'monospace',
                  letterSpacing: 4,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'COMMUNICATION CONSOLE',
                style: TextStyle(
                  color: Color(0xFF8F6873),
                  fontFamily: 'monospace',
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
