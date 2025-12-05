import React, { useState, useRef, useEffect } from "react";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import { AccountCircleSVG } from "../../../assets/svgs/AccountCircleSVG";
import { LightModeSVG } from "../../../assets/svgs/LightModeSVG";
import { DarkModeSVG } from "../../../assets/svgs/DarkModeSVG";
import { FiLogIn, FiChevronDown, FiUserX } from "react-icons/fi";
import { Button } from "../../ui/button";
interface Props {
  isAuthenticated: boolean;
  userName: string | null;
  userAvatar: string;
  authenticate: () => void;
  setTheme: (val: string) => void;
}

const NavBar: React.FC<Props> = ({
  isAuthenticated,
  userName,
  userAvatar,
  authenticate,
  setTheme
}) => {
  const [isOpenBlockedNamesModal, setIsOpenBlockedNamesModal] =
    useState<boolean>(false);

  const [openUserDropdown, setOpenUserDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const onCloseBlockedNames = () => {
    setIsOpenBlockedNamesModal(false);
  };

  return (
    <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-sky-800/60 bg-sky-950/80 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        {(
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-sky-700/60 p-2 transition hover:border-sky-500/70"
              onClick={() => setTheme("dark")}
              aria-label="Switch to dark theme"
            >
              <DarkModeSVG width="18" height="18" color="white" />
            </button>
            <button
              type="button"
              className="rounded-full border border-sky-700/60 p-2 transition hover:border-sky-500/70"
              onClick={() => setTheme("light")}
              aria-label="Switch to light theme"
            >
              <LightModeSVG width="18" height="18" color="white" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        {!isAuthenticated && (
          <Button onClick={authenticate} className="gap-2">
            <FiLogIn />
            Authenticate
          </Button>
        )}
        
        {isAuthenticated && userName && (
          <>
            <button
              type="button"
              onClick={() => setOpenUserDropdown((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-sky-800/60 bg-sky-900/40 px-3 py-1.5 text-sm font-semibold text-sky-100 transition hover:border-sky-600"
            >
              <span>{userName}</span>
              {!userAvatar ? (
                <AccountCircleSVG color="#cbd5e1" width="26" height="26" />
              ) : (
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  width="26"
                  height="26"
                  className="rounded-full"
                />
              )}
              <FiChevronDown />
            </button>
          </>
        )}
        
        {openUserDropdown && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-sky-800/60 bg-sky-950/95 shadow-xl">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-sky-100 hover:bg-sky-900/70"
              onClick={() => {
                setIsOpenBlockedNamesModal(true);
                setOpenUserDropdown(false);
              }}
            >
              <FiUserX className="text-red-400" />
              Blocked Names
            </button>
          </div>
        )}
        {isOpenBlockedNamesModal && (
          <BlockedNamesModal
            open={isOpenBlockedNamesModal}
            onClose={onCloseBlockedNames}
          />
        )}
      </div>
    </header>
  );
};

export default NavBar;
