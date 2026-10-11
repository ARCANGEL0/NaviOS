import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/navi_home.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const NaviMobileApp());
}

class NaviMobileApp extends StatelessWidget {
  const NaviMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NAVI',
      debugShowCheckedModeBanner: false,
      home: const NaviHome(),
    );
  }
}
