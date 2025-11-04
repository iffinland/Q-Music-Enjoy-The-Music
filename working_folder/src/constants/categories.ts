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

export type MusicCategory = typeof MUSIC_CATEGORIES[number];
export type PodcastCategory = typeof PODCAST_CATEGORIES[number];
