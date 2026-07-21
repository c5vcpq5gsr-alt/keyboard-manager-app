# Keyboard Manager

Desktop-Anwendung zur Verwaltung einer Keyboard-Sammlung mit Boards, Komponenten, Notizen und Fotos.

## Funktionen

- Erfassung, Übersicht und Galerie
- Spotlight und Foto-Großansicht
- SQLite-Datenbank mit verwaltetem Fotoordner
- Automatische Begrenzung importierter Fotos auf maximal 1920 x 1080
- Bestandsberichte als PDF und bearbeitbare Bestandslisten als Excel-Arbeitsmappe
- Plattformübergreifende ZIP-Backups mit Manifest und Bilddateien
- Automatische Migration älterer IndexedDB-Daten

## Screenshots

| Erfassung | Übersicht |
| --- | --- |
| <img src="Screens/a_Erfassen%20001%20Keyboards.png" alt="Keyboard-Erfassung" width="420"> | <img src="Screens/b_Uebersicht%20001%20Keyboards.png" alt="Keyboard-Übersicht" width="420"> |
| <img src="Screens/a_Erfassen%20002%20Keycaps.png" alt="Keycap-Erfassung" width="420"> | <img src="Screens/b_Uebersicht%20002%20Keycaps.png" alt="Keycap-Übersicht" width="420"> |
| <img src="Screens/a_Erfassen%20003%20Artisans.png" alt="Artisan-Erfassung" width="420"> | <img src="Screens/b_Uebersicht%20003%20Artisans.png" alt="Artisan-Übersicht" width="420"> |
| <img src="Screens/a_Erfassen%20004%20Switches.png" alt="Switch-Erfassung" width="420"> | <img src="Screens/b_Uebersicht%20004%20Switches.png" alt="Switch-Übersicht" width="420"> |

| Galerie |
| --- |
| <img src="Screens/c_Galerie%20001%20Keyboards.png" alt="Keyboard-Galerie" width="420"> |
| <img src="Screens/c_Galerie%20002%20Keycaps.png" alt="Keycap-Galerie" width="420"> |
| <img src="Screens/c_Galerie%20003%20Artisans.png" alt="Artisan-Galerie" width="420"> |

## Entwicklung

```bash
npm install
npm start
```

## Tests

```bash
npm test
npm run test:migration
npm run test:storage
npm run test:close
npm run test:photos
npm run test:export
npm run test:inventory-export
npm run test:spotlight
npm run test:keycaps
npm run test:switches
npm run test:board-links
npm run test:editor-return
```

## Builds

```bash
npm run build
npm run build:mac
npm run build:win
```

`npm run build:mac` erzeugt mit der lokalen Developer-ID und dem Keychain-Profil `keyboard-manager-notary` signierte und von Apple notarisierte DMGs für Apple Silicon und Intel.

Windows-Builds werden zusätzlich über GitHub Actions erstellt. Ein Versions-Tag erzeugt automatisch ein GitHub Release mit macOS-DMGs, Windows-Installer und portabler Windows-App.

Für signierte und notarisierte macOS-Builds in GitHub Actions müssen diese Repository-Secrets eingerichtet sein:

- `MACOS_CERTIFICATE_P12`: base64-kodierter Export des Developer-ID-Zertifikats samt privatem Schlüssel
- `MACOS_CERTIFICATE_PASSWORD`: Exportpasswort der `.p12`-Datei
- `APPLE_API_KEY_P8`: Inhalt des privaten App-Store-Connect-API-Keys
- `APPLE_API_KEY_ID`: Key-ID aus App Store Connect
- `APPLE_API_ISSUER`: Issuer-ID aus App Store Connect

Die privaten Dateien und Passwörter dürfen niemals in das Repository eingecheckt werden.

Der Quellcode und die fertigen Downloads sollen im öffentlichen GitHub-Repository zusammenliegen. Dadurch können Tester die App direkt herunterladen und bei Bedarf den Code, die Build-Konfiguration und die verwendeten Abhängigkeiten prüfen.

### Installation und Updates auf Windows

Der Windows-Installer erkennt eine bestehende Keyboard-Manager-Installation über die unveränderte App-ID und kann sie aktualisieren. Der Installationsassistent bietet die Auswahl zwischen aktuellem Benutzer und allen Benutzern sowie eine wählbare Zielmappe.

Vor einem Update muss Keyboard Manager beendet werden. Die Nutzerdaten liegen unabhängig vom Installationsordner unter `%APPDATA%\Keyboard Manager\`:

- `keyboard-manager.sqlite`: Boards und Einstellungen
- `photos\`: importierte Fotos

Die Deinstallation entfernt diese Nutzerdaten nicht. Vor größeren Updates empfiehlt sich trotzdem ein ZIP-Backup aus der Anwendung.

### Installation auf macOS

Die macOS-Release-Builds sind mit einer Apple Developer ID signiert und von Apple notarisiert. Gatekeeper kann dadurch Herkunft und Unversehrtheit der App regulär prüfen.

1. App aus dem DMG in den Programme-Ordner ziehen.
2. `Keyboard Manager` im Programme-Ordner normal öffnen.

## Lizenz und Credits

Keyboard Manager ist Open Source und steht unter der MIT-Lizenz. Die Idee, Anforderungen und Produktverantwortung liegen bei R3D42. Die Umsetzung erfolgte mit Unterstützung von OpenAI Codex.
