import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import {
  makeRedirectUri,
  useAuthRequest,
  exchangeCodeAsync,
  ResponseType,
} from 'expo-auth-session';
import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './src/config';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [savedTrackIds, setSavedTrackIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = makeRedirectUri({ useProxy: true } as any);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES.split(' '),
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
      extraParams: { show_dialog: 'true' },
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success' && request) {
      const code = response.params.code;
      const codeVerifier = request.codeVerifier;

      if (!codeVerifier) {
        setError('Errore PKCE: mancante code_verifier.');
        return;
      }

      setLoading(true);
      exchangeCodeAsync(
        {
          clientId: SPOTIFY_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: codeVerifier },
        },
        discovery
      )
        .then((tokenResponse) => {
          if (tokenResponse.accessToken) {
            setAccessToken(tokenResponse.accessToken);
            setError(null);
          } else {
            setError('Impossibile ottenere il token di accesso.');
          }
        })
        .catch((e) => {
          setError(`Autenticazione Spotify fallita: ${e.message}`);
        })
        .finally(() => setLoading(false));
    }
  }, [response, request, redirectUri]);

  useEffect(() => {
    if (accessToken) {
      loadSpotifyData(accessToken);
    }
  }, [accessToken]);

  const fetchSpotify = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Spotify API error ${response.status}`);
    }
    return response.json();
  };

  const loadSpotifyData = async (token: string) => {
    setLoading(true);
    setError(null);

    try {
      const [profileRes, topTracksRes, topArtistsRes, savedRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch('https://api.spotify.com/v1/me/top/tracks?limit=20', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch('https://api.spotify.com/v1/me/top/artists?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
      ]);

      setProfile(profileRes);
      setTopTracks(topTracksRes.items ?? []);
      setTopArtists(topArtistsRes.items ?? []);
      setSavedTrackIds((savedRes.items ?? []).map((item: any) => item.track.id));
    } catch (e: any) {
      setError(e.message ?? 'Errore caricamento Spotify.');
    } finally {
      setLoading(false);
    }
  };

  const saveTrack = async (trackId: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Errore salvataggio preferito.');
      }

      setSavedTrackIds((current) => Array.from(new Set([...current, trackId])));
      Alert.alert('Salvato', 'La canzone è stata aggiunta ai preferiti Spotify.');
    } catch (e: any) {
      setError(e.message ?? 'Errore durante il salvataggio.');
    } finally {
      setLoading(false);
    }
  };

  const genreCount = topArtists
    .flatMap((artist) => artist.genres ?? [])
    .reduce((acc: Record<string, number>, genre: string) => {
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});

  const favoriteGenres = (Object.entries(genreCount) as [string, number][]) 
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([genre]) => genre);

  const tasteSummary = favoriteGenres.length
    ? favoriteGenres.join(', ')
    : 'Ascolta canzoni per creare il profilo musicale.';

  const renderTrack = ({ item }: { item: any }) => {
    const artists = item.artists.map((artist: any) => artist.name).join(', ');
    const imageUrl = item.album.images?.[0]?.url;
    const isSaved = savedTrackIds.includes(item.id);

    return (
      <View style={styles.card}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.albumImage} /> : null}
        <View style={styles.cardContent}>
          <Text style={styles.trackTitle}>{item.name}</Text>
          <Text style={styles.trackSubtitle}>{artists}</Text>
          <Text style={styles.trackSubtitle}>{item.album.name}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, isSaved ? styles.disabledButton : styles.primaryButton]}
              onPress={() => saveTrack(item.id)}
              disabled={isSaved}
            >
              <Text style={styles.actionButtonText}>{isSaved ? 'Preferita' : 'Aggiungi ai preferiti'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Music Match</Text>
        <Text style={styles.headerSubtitle}>TikTok + Tinder per la musica</Text>
      </View>

      {!accessToken ? (
        <View style={styles.centered}>
          <Text style={styles.infoText}>
            Accedi con Spotify per vedere i tuoi brani preferiti, i top track e il profilo musicale.
          </Text>
          <Button
            title="Accedi con Spotify"
            onPress={() => promptAsync({ showInRecents: true })}
            disabled={!request || loading}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {loading ? <ActivityIndicator size="large" color="#1DB954" style={styles.loading} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.profileCard}>
            <Text style={styles.profileName}>{profile?.display_name || 'Spotify User'}</Text>
            <Text style={styles.profileText}>Follower: {profile?.followers?.total ?? '--'}</Text>
            <Text style={styles.profileText}>Gusti musicali: {tasteSummary}</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Feed musicale</Text>
            <Text style={styles.sectionSubtitle}>Scorri le tracce e salva quelle che ti piacciono su Spotify.</Text>
          </View>

          <FlatList
            data={topTracks}
            renderItem={renderTrack}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trackList}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top artisti</Text>
          </View>
          <View style={styles.tagList}>
            {topArtists.map((artist) => (
              <View key={artist.id} style={styles.genreTag}>
                <Text style={styles.genreTagText}>{artist.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#b3b3b3',
    marginTop: 6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    paddingBottom: 40,
  },
  loading: {
    marginTop: 20,
  },
  infoText: {
    marginBottom: 20,
    color: '#d1d1d1',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4f67',
    marginTop: 16,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#121212',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  profileText: {
    color: '#d1d1d1',
    marginTop: 8,
    lineHeight: 22,
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#b3b3b3',
    marginTop: 4,
  },
  trackList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  card: {
    width: 280,
    backgroundColor: '#181818',
    borderRadius: 20,
    marginRight: 16,
    overflow: 'hidden',
  },
  albumImage: {
    width: '100%',
    height: 180,
  },
  cardContent: {
    padding: 16,
  },
  trackTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  trackSubtitle: {
    color: '#b3b3b3',
    marginTop: 6,
  },
  cardActions: {
    marginTop: 16,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1DB954',
  },
  disabledButton: {
    backgroundColor: '#3a3a3a',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
  },
  genreTag: {
    backgroundColor: '#1f1f1f',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  genreTagText: {
    color: '#ffffff',
  },
});
