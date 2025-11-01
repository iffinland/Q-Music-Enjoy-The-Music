import React from "react";
import { Song } from "../types";
import SearchContent from "./SearchContent";

interface LikedContentProps {
  songs: Song[];
}

export const LikedContent: React.FC<LikedContentProps> = ({ songs }) => {
  return <SearchContent songs={songs} />;
};

export default LikedContent;
