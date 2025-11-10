export const MUSIC_CATEGORIES = [
  'Alternative & Indie',
  'Ambient & Chill',
  'Classical & Orchestra',
  'Country & Folk',
  'Electronic & Dance',
  'Trance',
  'Hip-Hop & Rap',
  'Jazz & Blues',
  'Pop',
  'Reggae & Dub',
  'R&B & Soul',
  'Rock & Metal',
  'Singer-Songwriter',
  'World & Ethnic',
  'Other',
] as const;

export const PODCAST_CATEGORIES = [
  'Arts & Culture',
  'Alternative Views',
  'Business & Finance',
  'Comedy',
  'Conspiracy',
  'Education',
  'Health & Wellness',
  'Lifestyle & Relationships',
  'Music & Entertainment',
  'News & Politics',
  'Science & Technology',
  'Spirituality',
  'Sports',
  'Storytelling & Fiction',
  'Other',
] as const;

export const AUDIOBOOK_CATEGORIES = [
  'Biographies & Memoirs',
  'Business & Finance',
  'Children & Family',
  'Education & Self-Help',
  'Fantasy',
  'Historical',
  'Mystery & Thriller',
  'Romance',
  'Science Fiction',
  'Science & Technology',
  'Spirituality',
  'True Crime',
  'Wellness',
  'Other',
] as const;

export type MusicCategory = typeof MUSIC_CATEGORIES[number];
export type PodcastCategory = typeof PODCAST_CATEGORIES[number];
export type AudiobookCategory = typeof AUDIOBOOK_CATEGORIES[number];

export const VIDEO_CATEGORIES = [...MUSIC_CATEGORIES] as const;

export const PLAYLIST_CATEGORIES = [
  'All-Day Chill',
  'Deep Focus',
  'Morning Energy',
  'Night Drive',
  'Party & Dance',
  'Workout Push',
  'Relax & Sleep',
  'Seasonal Picks',
  'Community Favorites',
  'Other',
] as const;

export type VideoCategory = typeof VIDEO_CATEGORIES[number];
export type PlaylistCategory = typeof PLAYLIST_CATEGORIES[number];
