export type PublishType = 'audio' | 'podcast' | 'audiobook' | 'video' | 'playlist' | 'multi';

export type MultiEntryType = Extract<PublishType, 'audio' | 'podcast' | 'audiobook'>;
