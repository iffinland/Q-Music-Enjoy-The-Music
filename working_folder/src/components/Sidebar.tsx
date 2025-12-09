import { HiHome } from "react-icons/hi";
import { BiSearch, BiListPlus } from "react-icons/bi";
import { twMerge } from "tailwind-merge";
import { useLocation } from "react-router-dom";
import { TbPlaylist } from "react-icons/tb";
import { MdLibraryMusic, MdOutlineFavorite } from "react-icons/md";
import { FiMessageSquare } from "react-icons/fi";
import { FaPodcast, FaBookOpen } from "react-icons/fa";
import SidebarItem from "./SidebarItem";
import Box from "./Box";
import { AddLibrary } from "./AddLibrary";
import { useMemo, useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { Song } from "../types";
import usePlayer from "../hooks/usePlayer";
import useSendTipModal from "../hooks/useSendTipModal";

interface SidebarProps {
  children: React.ReactNode;
  songs: Song[];
}

const Sidebar = ({ children, songs }: SidebarProps) => {
  const location = useLocation();
  const pathname = useMemo(() => {
    return location.pathname;
  }, [location]);
  const player = usePlayer();
  const matchPath = useCallback(
    (paths: string | string[]) => {
      const list = Array.isArray(paths) ? paths : [paths];
      return list.some((path) => {
        if (path === "/") return pathname === "/";
        return pathname === path || pathname.startsWith(`${path}/`);
      });
    },
    [pathname]
  );

  const routes = useMemo<SidebarRoute[]>(
    () => [
      {
        icon: HiHome,
        label: "Home",
        active: matchPath("/"),
        href: "/",
      },
      {
        icon: MdLibraryMusic,
        label: "Browse & Listen Songs",
        active: matchPath("/songs"),
        href: "/songs",
      },
      {
        icon: FaPodcast,
        label: "Browse & Listen Podcasts",
        href: "/podcasts",
        active: matchPath("/podcasts"),
      },
      {
        icon: FaBookOpen,
        label: "Browse & Listen Audiobooks",
        href: "/audiobooks",
        active: matchPath("/audiobooks"),
      },
      {
        icon: TbPlaylist,
        label: "Browse & Listen Playlists",
        href: "/playlists/all",
        active: matchPath(["/playlists/all", "/playlists"]),
      },
      {
        icon: MdOutlineFavorite,
        label: "My Library & Favorites",
        href: "/library",
        active: matchPath(["/library", "/liked"]),
      },
      {
        icon: BiListPlus,
        label: "Requests & Fillings",
        href: "/requests",
        active: matchPath(["/requests"]),
      },
      {
        icon: BiSearch,
        label: "Search Content",
        href: "/search",
        active: matchPath("/search"),
      },
      {
        icon: FiMessageSquare,
        label: "Discussion Boards",
        href: "/discussions",
        active: matchPath("/discussions"),
      },
    ],
    [matchPath]
  );

  return (
    <div
      className={twMerge(
        `
        flex
        h-full
        `,
        player.activeId && "h-[calc(100%-80px)]"
      )}
    >
      <main className="h-full flex-1 overflow-y-auto bg-gradient-to-b from-sky-900/70 to-sky-950/95">
        <MobileSidebarToggle songs={songs} routes={routes} />
        <div className="py-3 px-2">{children}</div>
      </main>
      <DesktopSidebar songs={songs} routes={routes} />
    </div>
  );
};

export default Sidebar;

interface SidebarRoute {
  icon: any;
  label: string;
  active: boolean;
  href: string;
  onClick?: () => void;
}

interface SidebarContentProps {
  songs: Song[];
  routes: SidebarRoute[];
  onNavigate?: () => void;
}

const DONATION_RECIPIENT = "QTowvz1e89MP4FEFpHvEfZ4x8G3LwMpthz";

const CHAT_GROUP_ID = 827;
const CHAT_APP_URL = "qortal://APP/Q-Chat";
const CHAT_JOIN_FALLBACK_URL = "qortal://use-group/action-join/groupid-827";
const SEND_MAIL_URL = "qortal://APP/Q-Mail/to/Q-Music";

const buildChatRenderUrl = () => {
  if (typeof window === "undefined") return CHAT_APP_URL;
  const current = new URL(window.location.href);
  const theme = current.searchParams.get("theme") || "dark";
  const lang = current.searchParams.get("lang") || "en";
  const identifier = current.searchParams.get("identifier");
  const params = new URLSearchParams({
    theme,
    lang,
  });
  if (identifier) {
    params.set("identifier", identifier);
  }
  return `${current.origin}/render/APP/Q-Chat?${params.toString()}`;
};

const requestOpenChatAppTab = () => {
  if (typeof window === "undefined") return false;
  const payload = {
    action: "SET_TAB",
    requestedHandler: "UI",
    payload: {
      service: "APP",
      name: "Q-Chat",
    },
  };
  try {
    const targetOrigin = window.location.origin;
    window.parent?.postMessage(payload, targetOrigin);
    return true;
  } catch (error) {
    console.warn("Failed to request opening Q-Chat tab", error);
    return false;
  }
};

const openQortalLink = (url: string) => {
  if (typeof window === "undefined") return;

  try {
    window.location.href = url;
    return;
  } catch (error) {
    console.warn("Failed to navigate via location.href", error);
  }

  try {
    window.location.assign(url);
    return;
  } catch (error) {
    console.warn("Failed to navigate via location.assign", error);
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noreferrer noopener";
  anchor.target = "_blank";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  toast.error(`Could not open link automatically. Please open: ${url}`);
};

const getErrorMessage = (error: unknown): string => {
  if (!error) return "";
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
};

const isAlreadyMemberError = (message: string) =>
  /already.*(member|joined)/i.test(message);

const SidebarContent: React.FC<SidebarContentProps> = ({
  songs,
  routes,
  onNavigate,
}) => {
  const sendTipModal = useSendTipModal();
  const [isJoiningChat, setIsJoiningChat] = useState(false);

  const openChatApp = useCallback(() => {
    const posted = requestOpenChatAppTab();
    const renderUrl = buildChatRenderUrl();

    if (!posted) {
      openQortalLink(renderUrl);
      return;
    }

    setTimeout(() => {
      openQortalLink(renderUrl);
    }, 400);
  }, []);

  const handleJoinChatClick = useCallback(async () => {
    if (isJoiningChat) return;

    setIsJoiningChat(true);
    try {
      if (typeof qortalRequest !== "function") {
        toast("Qortal API is not available. Opening join link...");
        openQortalLink(CHAT_JOIN_FALLBACK_URL);
        return;
      }

      await qortalRequest({
        action: "JOIN_GROUP",
        groupId: CHAT_GROUP_ID,
      });

      toast.success("Joined the chat group. Opening chat...");
      openChatApp();
    } catch (error: any) {
      const message = getErrorMessage(error) || "Could not join the chat right now.";

      if (isAlreadyMemberError(message)) {
        toast("You are already a member. Opening chat...");
        openChatApp();
        return;
      }

      toast.error(message);
    } finally {
      setIsJoiningChat(false);
    }
  }, [isJoiningChat]);

  const handleSendMailClick = useCallback(() => {
    openQortalLink(SEND_MAIL_URL);
  }, []);

  const handleDonateClick = useCallback(() => {
    sendTipModal.open(DONATION_RECIPIENT);
  }, [sendTipModal]);

  return (
    <>
      <Box className="overflow-y-auto flex-grow">
        <div className="flex flex-col gap-y-1 px-5 py-4">
          {routes.map((item) => (
            <SidebarItem key={item.label} {...item} onNavigate={onNavigate} />
          ))}
          <AddLibrary songs={songs} />
        </div>
      </Box>
      <div className="flex flex-col gap-3 px-5 py-4">
        <button
          type="button"
          onClick={handleDonateClick}
          className="donate-button-glow flex flex-col items-center gap-0.5 rounded-lg border border-amber-300/80 bg-gradient-to-r from-amber-400/90 via-orange-500/90 to-pink-500/80 px-4 py-2 text-center text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/40 transition hover:scale-[1.01] hover:shadow-amber-400/70"
        >
          Donate Project
          <span className="text-[11px] font-medium text-slate-900/80"></span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleJoinChatClick}
            disabled={isJoiningChat}
            className={`rounded-md border border-emerald-500/60 bg-emerald-700/40 px-3 py-2 text-center text-sm font-semibold text-emerald-100 transition ${
              isJoiningChat
                ? "opacity-70 cursor-not-allowed"
                : "hover:bg-emerald-600/60 hover:text-white"
            }`}
          >
            {isJoiningChat ? "Joining..." : "Join CHAT"}
          </button>
          <button
            type="button"
            onClick={handleSendMailClick}
            className="rounded-md border border-cyan-400/50 bg-cyan-700/40 px-3 py-2 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-600/60 hover:text-white"
          >
            Send Q-MAIL
          </button>
        </div>
        <div className="bg-sky-900/80 border border-sky-500/40 px-5 py-2 rounded-md flex items-center justify-center text-sm font-medium text-sky-200/80">
          <span>APP version 1.4 RC</span>
        </div>
      </div>
    </>
  );
};

const DesktopSidebar: React.FC<SidebarContentProps> = ({ songs, routes }) => (
  <div className="hidden md:flex flex-col gap-y-2 bg-gradient-to-b from-sky-900/70 to-sky-950/95 h-full w-[300px] p-2">
    <SidebarContent songs={songs} routes={routes} />
  </div>
);

const MobileSidebarToggle: React.FC<SidebarContentProps> = ({
  songs,
  routes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <div className="md:hidden px-4 pt-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-md border border-sky-500/40 bg-sky-900/60 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-800/60"
        >
          Open navigation &amp; stats
        </button>
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-sky-950/80 backdrop-blur-sm">
          <div className="mt-10 w-full max-w-md space-y-3 rounded-2xl border border-sky-700/60 bg-sky-950/95 p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-200/80">
                Navigation &amp; stats
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-sky-700/50 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:bg-sky-800/50"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <SidebarContent
                songs={songs}
                routes={routes}
                onNavigate={() => setIsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
