# Whitestar LED Ghosting Patch

Independent browser tool against **LED ghosting** on **Whitestar** pinball machines: a
compatibility adjustment of the lamp-matrix timing for LED lamps on hardware designed for
incandescent bulbs. Works with The Simpsons Pinball Party (TSPP) and others. Open the page,
choose your own CPU ROM, save the adjusted copy of it. Nothing is installed, nothing is uploaded:
the file stays in your browser.

## Start (Windows)

1. **Code → Download ZIP** on this page, unzip it anywhere.
2. Double-click **`start.bat`**. Your browser opens the patcher with the full description.
   A black window stays open; close it when you are done.

`start.bat` only runs `serve.ps1`: a tiny web server built into Windows PowerShell, reachable
only from your own computer (`http://localhost:8792`). Nothing is installed, nothing is sent
anywhere, and this project does not host the tool online. Windows may ask once whether to run a
downloaded file; both files are plain text, you can read them first.

Other systems: open `index.html` in a current browser, or run `python3 -m http.server` in this
folder and open the address it prints.

**Start (Deutsch):** Code → Download ZIP, entpacken, `start.bat` doppelklicken. Der Browser
öffnet Patcher und Beschreibung von deinem eigenen Rechner aus; das schwarze Fenster am Ende
schließen. Nichts wird installiert oder hochgeladen, online gehostet wird nichts.

> ## ⚠️ At your own risk / Auf eigene Gefahr
>
> **EN:** You use this patcher and any file it produces entirely at your own risk. The authors
> accept no liability for any damage to your machine, its boards, lamps, EPROMs, data
> (settings, audits, high scores) or anything else, nor for any consequence of using it.
> Always keep your original EPROM.
>
> **DE:** Du nutzt diesen Patcher und jede damit erzeugte Datei vollständig auf eigenes Risiko.
> Die Autoren haften nicht für Schäden an deinem Gerät, seinen Platinen, Lampen, EPROMs, Daten
> (Einstellungen, Audits, Highscores) oder sonstigem, auch nicht für Folgen der Nutzung.
> Bewahre immer dein Original-EPROM auf.

## The problem

With LEDs in the lamp matrix a lamp glows faintly when the lamp one row further in the same
column is lit. On TSPP this is lamp n−8, e.g. Shoot Again (lamp 3) glows while lamp 11 is on.

## What the patch does (in words)

1. The old column data stay on until the new data replace them, instead of being cleared when
   the row goes off. The row that was just switched off finishes turning off through its own
   lamps.
2. Rows without any lit lamp are not switched on. Row 1 gets a 2.5 µs pulse because the I/O
   board watchdog listens on it; by our circuit calculation that pulse is far too short to light anything.

The row goes off at the same moment as before; the lamp interrupt runs a few microseconds longer,
in the emulator game and lamp shows keep their speed. The version text is
**not** changed (so no settings, audits or high scores are reset). Only the checksum shown in
the test menu differs. 48 bytes change in total; the new 29-byte routine sits in unused space
at the end of the ROM.

## Results

| | Original | Patched | How |
|---|---|---|---|
| Current through LED of lamp 3 while lamp 11 is lit (TSPP 5.00) | 60–110 µA | 0.0 µA | measured, multimeter, real machine |
| Lamps lit, lamp-on time, watchdog timing | – | same (±0.3 %) | MAME, all ROMs below |

| ROM | Status | Test-menu checksum after patch |
|---|---|---|
| The Simpsons Pinball Party CPU 5.00 | real machine, measured | `$D9FF` |
| The Simpsons Pinball Party CPU 4.00 | emulator only | `$37FF` |
| The Simpsons Pinball Party CPU 3.00 | emulator only | `$A1FF` |
| The Simpsons Pinball Party CPU 2.04 | emulator only | `$59FF` |
| The Lord of the Rings CPU 8.00 | emulator only | `$7DFF` |

Other Whitestar CPU ROMs: the patcher looks for the lamp driver and refuses unless all safety
checks pass. Such ROMs are untested – try them in PinMAME first.

## Self-check

```
node test.js <your-cpu-rom> [...]
```

## Legal

Independent hobby project, not affiliated with, endorsed or supported by Stern Pinball, Sega or
any rights holder. Game and company names only describe compatibility. This repository
contains **no ROM data**; you need your own ROM. Use it only with ROMs you are entitled to use,
on your own machine, and do not pass adjusted files on. Before saving, the page asks you
to confirm exactly this. No warranty.

## License / Lizenz

MIT License with an attribution requirement, see [LICENSE](LICENSE). Every copy, fork,
modified version or derived work (including websites and apps built on it) must visibly link
to the original repository, in its documentation and, if it has one, in its user interface:

**https://github.com/druckgott/whitestar-led-ghosting-patch**

Modified versions must say that they are modified.

**DE:** MIT-Lizenz mit Namensnennungspflicht, siehe [LICENSE](LICENSE). Jede Kopie, jeder Fork,
jede geänderte Fassung und jedes abgeleitete Werk (auch Webseiten und Apps darauf) muss
sichtbar auf das Original-Repository verweisen, in der Dokumentation und, falls vorhanden, in
der Oberfläche: https://github.com/druckgott/whitestar-led-ghosting-patch. Geänderte Fassungen
müssen als geändert gekennzeichnet sein.

---

**Deutsch, kurz:** Unabhängiges Browser-Werkzeug gegen LED-Ghosting bei Whitestar-Flippern:
Anpassung des Lampenmatrix-Timings an LED-Leuchtmittel (funktioniert mit The Simpsons Pinball
Party, TSPP, und anderen). Eigene CPU-ROM wählen, geänderte Kopie speichern; nichts
wird hochgeladen, hier liegt keine ROM. Der Patch lässt die alten Spaltendaten stehen, bis die neuen kommen, und
schaltet leere Zeilen nicht ein. Versionstext bleibt gleich, nichts wird zurückgesetzt.
Gemessen an TSPP 5.00: Geist 60–110 µA → 0,0 µA. **Nutzung auf eigene Gefahr, siehe oben.**

