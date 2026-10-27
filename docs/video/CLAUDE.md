# CLAUDE.md — reel promo Sindicato Baba

## Estado

Alta 27-oct-2026. Método de `~/Code/dpworld-video` (las tres I + producción) comprimido a dos días.
Intel (`intel.md`) e Inspo (`inspo.md`) hechos. Las direcciones A/B/C de `direcciones.md` quedaron
**descartadas** (27-oct): Mau eligió un cadáver exquisito en plastilina sobre la referencia 13 de Inspo
(Rick and Morty "Exquisite Corpse"). **Guion vigente:** `guion.html`, publicado en
https://claude.ai/artifact/1apYraSVGu4ZT7jfo18ZL1 (versión 3, aprobada por Mau el 27-oct): 8 clips,
~35 s, un estilo y una idea absurda por escena, encadenadas con «pero / por eso» (herramientas de
`dpworld-video/docs/guion/frameworks-storytelling.md`):
1 caricatura para adultos (la miss fabrica un raver con ADN de raptor + un vinil; el raptor le come la
cabeza) → 2 grafito, playa (la cola borra el dibujo; se electrocuta con un cable) → 3 años 30, Metro (todo
baila menos giulio, que enchufa sus audífonos en la cola) → 4 pixel art, azotea (los beats de lis son
power-ups; el raptor crece como kaiju) → 5 manga, Sabana Grande (amesty lo encoge con un tequeño) →
6 plastilina, ring de lucha en Chacaíto (BABATR aprieta PLAY y lo doma; la miss sale entera y lo corona).
Personajes de plastilina en `elements/personajes/`, hojas por estilo en `elements/estilos/`, stills en
`elements/stills/v2/` (+ `stills/3.png` y `stills/6b.png`). Ruta de producción elegida (opción 1): Mau
genera los clips en la web de Higgsfield con sus ilimitados (el MCP no tiene ilimitado:
`unlim.available=false`) y los deja en `elements/clips/1a.mp4`…; yo reviso con `check_clip.sh` de
dp-world, monto, pongo textos (patrón `cartelas.py`) y audio (`mezcla.py`).

**27-oct, tarde: borrador v1 montado.** Los ilimitados de Mau son solo de imagen y solo en la web, así que los
clips se pagaron con créditos: Mau compró 500 cr y los 8 clips salieron por el MCP con Seedance 2.0 a 720p
(22,5 cr c/u; IDs en `clips-seedance.json`; 4 se reenviaron con `declined_preset_id` porque Higgsfield
recomendaba presets). Wan 2.2 TI2V-5B en el pod `dpworld-render-gpu-3` se probó y se descartó (inventa
personajes que no están en el cuadro inicial; Mau: "WAN es horrible"); el pod quedó apagado y el modelo en
`/workspace/hf`. `docs/video/montaje.py` arma `elements/entregas/reel-borrador.mp4`: corte 1→5 s por clip,
1080×1920, nombres en Oswald con sombra del flyer, CTA congelado 3,5 s con logos; 35,5 s, **sin audio**
(falta el track). Saldo Higgsfield 320,3 cr.

**Revisión escena por escena** (patrón «toma a toma» de dp-world): https://claude.ai/artifact/KzFJsJB1Fy5Cb6Yy1JytVM.
Still, clip, diagnóstico y caja de nota por escena, más el track y notas generales. Las notas de Mau quedan en
la colección `notas` de su base (doc por escena: `1a`…`6b`, `cta`, `track`, `general`); leerlas con
`ArtifactData list`. Fuente y medios en el scratchpad de la sesión del 27-oct (`escenas/`).
**Clips nuevos en Kling, no en Seedance** (Mau, 27-oct: "kling es mucho mejor y más barato").

**27-oct, noche: guion v4** (`guion-v4.md`) con las notas de Mau al v1: un solo plano, sin textos ni CTA, 11 clips
con cuadro inicial y final. 17 stills en `elements/stills/v4/` (IDs en `stills-v4.json`), publicados en el mismo
artefacto para aprobar clip por clip (docs `v4-<clip>` de la colección `notas`, campo `aprobado`). Saldo 259,8 cr.

**27-oct, noche: piloto v4 en baja.** Notas de Mau: 1A con la miss en su computadora de hacker de los 90, y la 5 en
manga de duelo de cartas (estilo Yu-Gi-Oh, descrito sin nombrarlo). Se rehicieron 1b, 1c, 5s y 5e. Los 11 clips salieron
en **Kling 4.0** (`kling4_0`, image-to-video, 720p, cuadro inicial y final, ~2,5 cr por 5 s; Kling 3.0 pro cuesta
8,75), con IDs en `piloto-v4.json`, en `elements/clips/v4/`. `docs/video/montaje_v4.py` los encadena con fundidos
(blanco o negro en los portales) en `elements/entregas/piloto-v4.mp4` (720×1280, 57,5 s, sin audio). El piloto quedó
en el artefacto con su clip por ficha. Saldo 219,55 cr.

**27-oct, noche: v5.** Jurado del piloto: 4,5/10 (`jurado-piloto-v4.md`). Step-back y plan en `plan-v5.md`: relevo de
cuadro entre estilos (el inicio de cada estilo es el final anterior redibujado), un movimiento de cámara por clip, física
revisada en cada still, 1080p. 16 clips de Kling 4.0 en `elements/clips/v5/` (IDs en `clips-v5.json`), stills en
`elements/stills/v5/` (`stills-v5.json`). `montaje_v5.py` (24 fps, recortes y 1,2×) arma `elements/entregas/reel-v5.mp4`
(1080×1920, 52,3 s). Publicado en el artefacto (docs `v5-*`). Segundo jurado en curso → `jurado-reel-v5.md`.
Saldo 57,05 cr: la v5 costó ~162 cr.

**27-oct, noche: entradas animadas por DJ (tapas tipográficas). AGREGAR AL MONTAJE FINAL.** Cada DJ entra con una tapa
animada con su nombre sobre su escena. Las seis ya están hechas y aprobadas por Mau ("me gusta"); el montaje final
tiene que incluirlas, el `montaje_v5.py` actual todavía no. Spec: issue #8 de `anarculture/sindicato-baba`; tickets #9 y
#10 cerrados, #11 abierto (ronda de notas y entrega al montaje). Hoja de revisión con las seis vistas:
https://claude.ai/artifact/4nHQF2MCthoEVWexi75dwy.
- Estilos finales: miss venezuela = spray punk magenta · warapo = fuego · giulio = rubber hose años 30 · lis the producer
  = pixel arcade · amesty = onomatopeya de manga · DJ BABATR = 3D multicolor en arco.
- Entregables en `/home/acracia/Code/sindicato-baba/.claude/worktrees/tapas-motion/motion/renders/`: `<dj>.mov`
  (ProRes 4444 con alfa, 720×1280, 24 fps, 1,6 s) y `<dj>-vista.mp4` (vista previa de la entrada completa sobre el clip).
  Slugs: `miss-venezuela`, `warapo`, `giulio`, `lis-the-producer`, `amesty`, `dj-babatr`. Los genera el proyecto
  HyperFrames 0.8.162 + GSAP de `motion/` en ese worktree (rama `worktree-tapas-motion`, sin commit todavía):
  `compositions/<dj>.html`, `assets/tapas/<dj>.png` sin fondo, `render.sh`, `render-todas.sh`.
- Cómo entra cada DJ: el clip de su escena baja a cámara lenta el último 0,5 s (mitad de velocidad), 2 cuadros de
  destello blanco, cuadro congelado 1,6 s (saturación 0.6, contraste 1.2, brillo -0.08, acercamiento lento) con el `.mov`
  encima, y el clip sigue.
- Cuadro de congelado por clip del borrador v1: miss-venezuela clip 1a cuadro 84 · warapo clip 2 cuadro 60 · giulio clip 3
  cuadro 60 · lis-the-producer clip 4 cuadro 36 · amesty clip 5 cuadro 12 · dj-babatr clip 6a cuadro 60. Si un clip se
  rehace en Kling (como los de v4/v5), hay que volver a elegir el cuadro de congelado: el DJ tiene que estar a la vista.
- Duración: cada entrada suma ~2,1 s (0,5 s de cámara lenta extra + 2 cuadros + 1,6 s de congelado). Seis entradas
  alargan el reel unos 12-13 s. El corte final va al golpe del track, que todavía falta.

**27-oct, 18:30: reel híbrido.** Jurado v5: 6,5/10 (`jurado-reel-v5.md`). `montaje_hibrido.py` arma
`elements/entregas/reel-hibrido.mp4` (1080×1920, 56,8 s, sin audio, 0 cr): v5 en 1a, 1b, 3a, 4a, 4b, 5a, 5b (recortes
del jurado, 1,3×) y v4 en 1c, 2, segunda mitad de 3 y 6a–6d, con las seis entradas de DJ (`INTROS`: clip, segundo de
congelado y tapa). Saldo 44,05 cr: 13 cr se fueron en GPT Image 2.5 Flare entre 17:48 y 17:58, fuera de esta sesión.
**Mau lo aprobó ("va") para publicarlo a las 19:00.** Después se le sumó sonido. Track: RING THE ALARM (DJ Babatr
Remix), `/home/acracia/Music/1-01 RING THE ALARM (DJ Babatr Remix).mp3`, desde el 125,05 s: el drop (132,0 s) cae
en el tanque que revienta, reel 7,0 s. Debajo, el audio de Kling de cada clip (mismos recortes y fundidos) y SFX
sintéticos de ffmpeg: riser en cada cámara lenta, golpe grave y chasquido en cada congelado de DJ, whoosh en cada
cambio de estilo. La música se agacha bajo esos SFX. Higgsfield no sirve para SFX: `mirelo_text_to_audio` es solo
para su generador de juegos. `--solo-audio` rehace solo la mezcla. Pendiente tras publicar: 6d+6e y 5b (~23 cr), 6b, dancefloor.

**27-oct, 19:30: reel de 28,8 s.** Mau pidió ≤ 30 s acelerando las escenas (la música sigue a 1×) y sin los SFX
sintéticos ("no me gustaron los VFX"). `montaje_hibrido.py`: `VEL = 2.2` para todos los tramos (ya no hay `VELOCIDAD`),
entrada de DJ sin cámara lenta: destello de 4 cuadros y congelado de 1,0 s con la tapa acelerada 1,6× (`setpts` sobre el
`.mov`). Mezcla: solo música + audio de Kling, sin riser/golpe/chasquido/whoosh ni sidechain. `MUSICA_INICIO` se calcula
en el script a partir de `DROP` y `TANQUE` para que el drop siga cayendo en el tanque (reel 3,6 s). El script falla si el
total pasa de 30 s. Copia para el teléfono: `elements/entregas/reel-hibrido-movil.mp4` (< 30 MB, para `SendUserFile`).
Mau lo aprobó ("va", 19:40) y pidió cerrar con el flyer: `FLYER FINAL BABA.png` (4:5, centrado sobre sí mismo
desenfocado) 3,0 s al final con la música sonando (`FLYER`, `FLYER_DUR`); total 31,8 s.

## Qué es

Reel de Instagram para vender entradas de la fiesta DJ BABATR de Sindicato: jueves 29-oct-2026,
21:00 a cierre, CC Chacaíto. Elementos visuales nuevos (generados), no un flyer animado.

Terminado = reel 1080×1920, 15–20 s, aprobado por Mau y publicado el **28-oct**.

CTA: comprar entrada en https://postropicalia.com/sindicato-baba (en el reel: "link en bio" + la URL;
el reel no lleva link clickeable). Preventa $10 (Zelle/Binance) o €10 a tasa BCV (pago móvil); puerta $15.

## Datos del evento (del flyer final, `FLYER FINAL BABA.png`)

- Headliner: **DJ BABATR**. Lineup: amesty, miss vzla & warapo, lis the producer, giulio tafa.
  miss vzla = miss venezuela = Mau.
- Grilla (relevo del flyer, 26-oct): lis the producer 21–23 · giulio 23–01 · miss venezuela + warapo
  01–03 · DJ BABATR 03–05 · miss venezuela + amesty 05–cierre.
- Handle `@SINDICATO.CLUB`. Aliados: Cerveza Zulia, Bandera, Mal Portada (logos en `elements/`).

## Identidad visual (fuente: el flyer y `DESIGN.md`)

Fotocopia en blanco y negro de cables y fachada caraqueña teñida (azul `#8c9fc6`, también lima y
magenta en `elements/1.png`, `4.png`), letras de cromo líquido con destellos de cuatro puntas, un solo
verde neón `#2ed847` en el handle. Otros elementos del colectivo: SINDICATO rojo desgastado, rosa
neón, brillo de corazones rosa, `babatr_orbit.mp4` (BA/BA/TR en puntos blancos, 10 s, 4:5).

## Método

1. **Intel** → `docs/video/intel.md`: qué publica @sindicato.club, quién es DJ BABATR, qué reels de
   fiesta funcionan en Caracas.
2. **Inspo** → `docs/video/inspo.md`: reels de clubes y fiestas con cromo, fotocopia o tipografía cinética.
3. **Interact** → `docs/video/direcciones.md` + artefacto comparativo: 2–3 direcciones plano a plano,
   revisadas con made-to-stick e influence. Mau elige.
4. **Producción** → shot list, Higgsfield (stills y clips), texto animado, audio, montaje ffmpeg,
   verificación por plano, borrador para Mau, corte final.

## Restricciones

- Los assets (`FLYER FINAL BABA.png`, `elements/`, 193 MB) no van a git.
- Español de Venezuela en pantalla (la audiencia); los docs en español neutro.
- Audio sin decidir (track de BABATR o música de Instagram al subir): se cierra en Interact.
