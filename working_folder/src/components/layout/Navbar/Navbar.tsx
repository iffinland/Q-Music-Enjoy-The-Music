import React, { useState } from "react";
import { Box, Popover, useTheme } from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import {
  AvatarContainer,
  CustomAppBar,
  DropdownContainer,
  DropdownText,
  AuthenticateButton,
  NavbarName,
  LightModeIcon,
  DarkModeIcon,
  ThemeSelectRow,
  LogoContainer,
} from "./Navbar-styles";
import { AccountCircleSVG } from "../../../assets/svgs/AccountCircleSVG";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import { useNavigate } from "react-router-dom";
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
  const theme = useTheme();
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [isOpenBlockedNamesModal, setIsOpenBlockedNamesModal] =
    useState<boolean>(false);

  const [openUserDropdown, setOpenUserDropdown] = useState<boolean>(false);


  const handleClick = (event?: React.MouseEvent<HTMLDivElement>) => {
    const target = event?.currentTarget as unknown as HTMLButtonElement | null;
    setAnchorEl(target);
  };

  const handleCloseUserDropdown = () => {
    setAnchorEl(null);
    setOpenUserDropdown(false);
  };


  const onCloseBlockedNames = () => {
    setIsOpenBlockedNamesModal(false);
  };

  return (
    <CustomAppBar position="sticky" elevation={2}>
      <ThemeSelectRow>
        {theme.palette.mode === "dark" ? (
          <LightModeIcon
            onClickFunc={() => setTheme("light")}
            color="white"
            height="22"
            width="22"
          />
        ) : (
          <DarkModeIcon
            onClickFunc={() => setTheme("dark")}
            color="black"
            height="22"
            width="22"
          />
        )}
      
     
      </ThemeSelectRow>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}
      >
        {!isAuthenticated && (
          <AuthenticateButton onClick={authenticate}>
            <ExitToAppIcon />
            Authenticate
          </AuthenticateButton>
        )}
        
        {isAuthenticated && userName && (
          <>
            
            <AvatarContainer
              onClick={(e: any) => {
                handleClick(e);
                setOpenUserDropdown(true);
              }}
            >
              <NavbarName>{userName}</NavbarName>
              {!userAvatar ? (
                <AccountCircleSVG
                  color={theme.palette.text.primary}
                  width="32"
                  height="32"
                />
              ) : (
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  width="32"
                  height="32"
                  style={{
                    borderRadius: "50%"
                  }}
                />
              )}
              <ExpandMoreIcon id="expand-icon" sx={{ color: "#ACB6BF" }} />
            </AvatarContainer>
          </>
        )}
        
        <Popover
          id={"user-popover"}
          open={openUserDropdown}
          anchorEl={anchorEl}
          onClose={handleCloseUserDropdown}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left"
          }}
        >
          <DropdownContainer
            onClick={() => {
              setIsOpenBlockedNamesModal(true);
              handleCloseUserDropdown();
            }}
          >
            <PersonOffIcon
              sx={{
                color: "#e35050"
              }}
            />
            <DropdownText>Blocked Names</DropdownText>
          </DropdownContainer>
        </Popover>
        {isOpenBlockedNamesModal && (
          <BlockedNamesModal
            open={isOpenBlockedNamesModal}
            onClose={onCloseBlockedNames}
          />
        )}
      </Box>
    </CustomAppBar>
  );
};

export default NavBar;
