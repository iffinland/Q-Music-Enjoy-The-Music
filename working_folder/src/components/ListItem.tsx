
import { FaPlay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";



interface ListItemProps {
  image: string;
  name: string;
  href: string;
}

const ListItem: React.FC<ListItemProps> = ({
  image,
  name,
  href,
}) => {
  const navigate = useNavigate();

  const onClick = () => {
    if (!href) return;
    navigate(href);
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
        bg-sky-950/40
        border 
        border-sky-900/40
        cursor-pointer 
        hover:bg-sky-900/50 
        transition 
        pr-4
      "
    >
      <div className="relative min-h-[64px] min-w-[64px]">
        <img
          className="object-cover absolute"
          src={image}
          alt="Image"
        />
      </div>
      <p className="font-medium truncate py-5">
        {name}
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
        <FaPlay className="text-black" />
      </div>
    </button>
   );
}
 
export default ListItem;
