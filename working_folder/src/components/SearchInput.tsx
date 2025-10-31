
import Input from "./Input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, onEnter }) => {
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onEnter();
    }
  }
  
  return ( 
    <Input 
      placeholder="Search for songs, artists, playlists, videos, podcasts, and more..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleInputKeyDown}
    />
  );
}
 
export default SearchInput;