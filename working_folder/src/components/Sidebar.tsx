
import { HiHome } from "react-icons/hi";
import { BiSearch } from "react-icons/bi";
import { twMerge } from "tailwind-merge";
import { useLocation } from 'react-router-dom';
import { TbPlaylist } from "react-icons/tb";
import {IoMdCloudUpload} from "react-icons/io"
import { MdLibraryMusic } from "react-icons/md";
import SidebarItem from "./SidebarItem";
import Box from "./Box";
import {AddLibrary} from "./AddLibrary";
import { useMemo } from "react";
import { Song } from "../types";
import usePlayer from "../hooks/usePlayer";

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
      icon: MdLibraryMusic,
      label: 'Browse All Songs',
      active: pathname === '/songs',
      href: '/songs'
    },
    {
      icon: TbPlaylist,
      label: 'Browse All Playlists',
      href: '/playlists/all',
      active: pathname === '/playlists/all'
    },
    {
      icon: IoMdCloudUpload,
      label: 'My Favorites & Library',
      href: '/library',
      active: pathname === '/library' || pathname === '/liked'
    },
    {
      icon: BiSearch,
      label: 'Search',
      href: '/search',
      active: pathname === '/search'
    }
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
      <main className="h-full flex-1 overflow-y-auto py-3 px-2 bg-gradient-to-b from-sky-900/70 to-sky-950/95">
        {children}
      </main>
      <div 
        className="
          hidden 
          md:flex 
          flex-col 
          gap-y-2 
          bg-gradient-to-b from-sky-900/70 to-sky-950/95 
          h-full 
          w-[300px] 
          p-2
        "
      >
        <Box className="overflow-y-auto flex-grow">
          <div className="flex flex-col gap-y-1 px-5 py-4">
            {routes.map((item) => (
              <SidebarItem key={item.label} {...item} />
            ))}
            <AddLibrary songs={songs} />
          </div>
        </Box>
        <div className="bg-sky-900/80 border border-sky-500/40 px-5 py-1 rounded-md h-10 flex items-center justify-center text-sm font-medium text-sky-200/80">
          <span>Current version ALPHA</span>
        </div>
      </div>
    </div>
  );
}
 
export default Sidebar;
