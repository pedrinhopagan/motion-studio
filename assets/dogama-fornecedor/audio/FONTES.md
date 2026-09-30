# Áudio: origem, licença e medições

Licença: Mixkit Free License (uso comercial livre, sem atribuição). https://mixkit.co/license/

| Arquivo | Origem | Medição |
| --- | --- | --- |
| cant-get-you-off-my-mind.mp3 | Mixkit 1210 "Can't Get You Off My Mind" (Future bass; positiva), https://assets.mixkit.co/music/1210/1210.mp3 | 90,6 s; 75,00 BPM (batida 0,8 s, compasso 3,2 s); grave entra em 25,60 s (drop) |
| its-love.mp3 | (v1 a v3) Mixkit 834 "It's Love" (Corporate Music; uplifting, relaxed, motivational), https://assets.mixkit.co/music/834/834.mp3 | 96,6 s; 110,00 BPM (batida 0,5455 s, compasso 2,1818 s); só teclado até 21,86 s; bateria leve a partir daí; grave e bumbo entram em 39,32 s (compasso 19) |
| head-bang.mp3 | (v1, substituída) Mixkit "Head Bang", Arulo (Trap), https://assets.mixkit.co/music/357/357.mp3 | 97,3 s; intro calma até 12,94 s; drop (entrada do grave) em 12,94 s; grade 73,83 BPM (batida 0,8127 s, compasso 3,2508 s); pausa em 30,45 s |
| sfx/notificacao-dogama.mp3 | Som real de notificação do app, cópia de apps/front/src/assets/sounds/notification.mp3 (tocado por useHandleNewNotification) | 0,55 s de silêncio inicial, cortado na mixagem; ataque em 0,551 s |
| sfx/clique-mouse.wav | (v3) Mixkit 1113 "Mouse click close" | dois transientes: descer do botão em 0,011 s e subir em 0,137 s |
| sfx/tique.wav | (v3) Mixkit 1120 "Modern click box check" | ataque em 0,100 s; tonal perto de 620 a 670 Hz (Mi5), a mesma região da notificação |
| sfx/clique-mouse-2.wav | (v4) Mixkit 2997 "Clear mouse clicks" | descer do botão em 0,002 s e subir em 0,207 s |
| sfx/clique-digital.wav | (opção) Mixkit 3124 "Modern technology select" | toque tonal de 25 ms, perto de 1,9 kHz |
| sfx/bipe-digital.wav | (v4) Mixkit 2568 "Cool interface click tone" | bipe tonal de 30 ms, perto de 2 kHz |
| sfx/whoosh-camera.wav | (v4) Mixkit 168 "Fast air sweep transition" | pico em 0,28 s |
| sfx/whoosh-cursor.wav | (v4) Mixkit 166 "Fast small sweep transition" | pico em 0,30 s |
| sfx/publicar.wav | (v1 e v2) Mixkit 2865 "Success software tone" | pico 0,255 s |
| sfx/publicar-alt.mp3 | Mixkit 2354 "Message pop alert" (só preview) | pico 0,05 s |
| sfx/venda.wav | (v1) Mixkit 2356 "Dry pop up notification alert" | pico 0,045 s |
| sfx/scanner.wav | (v1 e v2) Mixkit 1073 "Shop scanner beeps" | bipes em 0,11 / 0,83 / 1,73 s; usar só o primeiro |
| sfx/repasse.wav | (v1 e v2) Mixkit 2003 "Coins sound" | pico 0,20 s |
| sfx/repasse-alt.wav | Mixkit 1992 "Coin win notification" | pico 0,10 s |

Trecho usado (v4): 12,80 s a 42,67 s de cant-get-you-off-my-mind.mp3, de modo que o drop cai na primeira venda, em 12,80 s do vídeo (b(24) na grade de 112,5 BPM da cena, 3 batidas da cena para 2 da faixa). Uma notificação só, nessa venda. Balanço escolhido na página de audição: música 35%, efeitos 50%, música abafada até o drop.

Trecho usado (v3): 26,23 s a 56,78 s de its-love.mp3 (compassos 13 a 26), de modo que o drop cai na primeira venda, em 13,09 s do vídeo. O som de movimento não vem de arquivo: é ruído rosa filtrado, sintetizado por scenes/dogama-fornecedor/sfx.py com a intensidade seguindo a velocidade do cursor e da câmera.

Tonalidade: a música está em Lá maior; a notificação da Dogama soa Mi5, Mi4 e Lá4, notas do mesmo tom.

Trecho usado (v2): 32,32 s a 50,32 s de its-love.mp3, de modo que o drop cai em 7,00 s do vídeo. Na v1 era 5,94 s a 23,94 s de head-bang.mp3.

A notificação é da própria Dogama e não está sob a licença Mixkit.
