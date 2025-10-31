
import { MdPlaylistAdd } from "react-icons/md";
import { useNavigate } from "react-router-dom";





export const AddPlayList = () => {
const navigate = useNavigate()
  
  const onClick = () => {
    navigate('/liked')

    // router.push(href);
  };

  return ( 
    <button
      onClick={onClick}
      className="
        relative 
        group 
        flex 
        items-center 
        rounded-md 
        overflow-hidden 
        gap-x-4 
        bg-neutral-100/10 
        cursor-pointer 
        hover:bg-neutral-100/20 
        transition 
        pr-4
      "
    >
     
      <p className="font-medium truncate py-5">
       New Playlist
      </p>
      <div 
        className="
          absolute 
          transition 
          opacity-0 
          rounded-full 
          flex 
          items-center 
          justify-center 
          bg-green-500 
          p-4 
          drop-shadow-md 
          right-5
          group-hover:opacity-100 
          hover:scale-110
        "
      >
        <MdPlaylistAdd className="text-black" />
      </div>
    </button>
   );
}
 
