# Music Match

Un'app ibrida ispirata a TikTok e Tinder, focalizzata sui brani Spotify. Connettiti al tuo account Spotify, esplora i tuoi top tracks, analizza i gusti musicali e salva canzoni dai preferiti.

## Funzionalità incluse

- Autenticazione Spotify con OAuth
- Recupero del profilo utente, top tracks e top artists
- Visualizzazione del feed musicale in stile card
- Salvataggio delle tracce nei preferiti Spotify
- Analisi rapida dei generi preferiti

## Setup rapido

1. Installa le dipendenze:

```bash
npm install
```

1. Crea un'app su Spotify Developer: <https://developer.spotify.com/dashboard/applications>

2. Copia il `Client ID` e incollalo in `src/config.ts` sostituendo `YOUR_SPOTIFY_CLIENT_ID`.

3. Aggiungi il redirect URI alla tua app Spotify:

```text
https://auth.expo.io/@your-username/music-match
```

> Se usi Expo senza account, puoi sostituire `@your-username` con il tuo username Expo.

1. Avvia l'app:

```bash
npm start
```

1. Usa Expo Go su mobile o apri l'app in un emulatore.

## Note

- L'app è un MVP: include login Spotify, feed musicale e salvataggio brani.
- Puoi estenderla aggiungendo swipe, match tra utenti e video brevi.
- Per funzionare correttamente, Spotify deve autorizzare il redirect URI.
