
import { HiHome } from "react-icons/hi";
import { BiSearch } from "react-icons/bi";
import { twMerge } from "tailwind-merge";
import { useLocation } from 'react-router-dom';
import { TbPlaylist } from "react-icons/tb";
import {IoMdCloudUpload} from "react-icons/io"
import {AiFillHeart} from "react-icons/ai"
import SidebarItem from "./SidebarItem";
import Box from "./Box";
import {AddLibrary} from "./AddLibrary";
import { useMemo } from "react";
import { Song } from "../types";
import usePlayer from "../hooks/usePlayer";
import {AiOutlineFieldTime} from "react-icons/ai"

interface SidebarProps {
  children: React.ReactNode;
  songs: Song[];
}

const Sidebar = ({ children, songs }: SidebarProps) => {
    const location = useLocation();
    const pathname = useMemo(()=> {

        return location.pathname
    }, [location])
  const player = usePlayer();

  const routes = useMemo(() => [
    {
      icon: HiHome,
      label: 'Home',
      active: pathname === '/',
      href: '/'
    },
    {
      icon: AiOutlineFieldTime,
      label: 'Newest songs',
      active: pathname === '/newest',
      href: '/newest'
    },
    {
      icon: AiFillHeart,
      label: 'Liked',
      active: pathname === '/liked',
      href: '/liked'
    },
    {
      icon: BiSearch,
      label: 'Search',
      href: '/search',
      active: pathname === '/search'
    },
    {
      icon: TbPlaylist,
      label: 'Playlists',
      href: '/playlists',
      active: pathname === '/playlists'
    },
    {
      icon: IoMdCloudUpload,
      label: 'Your Library',
      href: '/library',
      active: pathname === '/library'
    },
  ], [pathname]);

  return (
    <div 
      className={twMerge(`
        flex 
        h-full
        `,
        player.activeId && 'h-[calc(100%-80px)]'
      )}
    >
      <div 
        className="
          hidden 
          md:flex 
          flex-col 
          gap-y-2 
          bg-black 
          h-full 
          w-[300px] 
          p-2
        "
      >
        <Box>
          <div className="flex flex-col gap-y-4 px-5 py-4">
            {routes.map((item) => (
              <SidebarItem key={item.label} {...item} />
            ))}
          </div>
        </Box>
        <Box className="overflow-y-auto h-full">
          <AddLibrary songs={songs} />
        </Box>
      </div>
      <main className="h-full flex-1 overflow-y-auto py-2">
        {children}
      </main>
    </div>
  );
}
 
export default Sidebar;