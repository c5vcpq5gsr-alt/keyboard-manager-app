# Keyboard Manager

Desktop-Anwendung zur Verwaltung einer Keyboard-Sammlung mit Boards, Komponenten, Notizen und Fotos.

## Funktionen

- Erfassung, Übersicht und Galerie
- Spotlight und Foto-Großansicht
- SQLite-Datenbank mit verwaltetem Fotoordner
- Automatische Begrenzung importierter Fotos auf maximal 1920 x 1080
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

Windows-Builds werden zusätzlich über GitHub Actions erstellt. Ein Versions-Tag wie `v1.3.0` erzeugt automatisch ein GitHub Release mit ARM-macOS-DMG, Windows-Installer und portabler Windows-App.

Da die Builds nicht signiert sind, können macOS Gatekeeper beziehungsweise Windows SmartScreen beim ersten Start eine Warnung anzeigen.

Der Quellcode und die fertigen Downloads sollen im öffentlichen GitHub-Repository zusammenliegen. Dadurch können Tester die App direkt herunterladen und bei Bedarf den Code, die Build-Konfiguration und die verwendeten Abhängigkeiten prüfen.

### Installation und Updates auf Windows

Der Windows-Installer erkennt eine bestehende Keyboard-Manager-Installation über die unveränderte App-ID und kann sie aktualisieren. Der Installationsassistent bietet die Auswahl zwischen aktuellem Benutzer und allen Benutzern sowie eine wählbare Zielmappe.

Vor einem Update muss Keyboard Manager beendet werden. Die Nutzerdaten liegen unabhängig vom Installationsordner unter `%APPDATA%\Keyboard Manager\`:

- `keyboard-manager.sqlite`: Boards und Einstellungen
- `photos\`: importierte Fotos

Die Deinstallation entfernt diese Nutzerdaten nicht. Vor größeren Updates empfiehlt sich trotzdem ein ZIP-Backup aus der Anwendung.

### Installation auf macOS

Die macOS-App besitzt keine kostenpflichtige Apple-Developer-ID-Signatur. Deshalb blockiert Gatekeeper den ersten Start nach einem Download.

1. App aus dem DMG in den Programme-Ordner ziehen.
2. Im Programme-Ordner mit der rechten Maustaste auf `Keyboard Manager` klicken und `Öffnen` wählen.
3. Falls macOS die App weiterhin blockiert: `Systemeinstellungen` → `Datenschutz & Sicherheit` öffnen und bei Keyboard Manager `Dennoch öffnen` wählen.

Alternativ kann die Download-Quarantäne nach dem Kopieren im Terminal entfernt werden:

```bash
xattr -dr com.apple.quarantine "/Applications/Keyboard Manager.app"
```
