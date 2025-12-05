import React, { useState } from "react";
import {
  Box,
  Button,
  Modal,
  Typography,
  SelectChangeEvent,
  ListItem,
  List,
  useTheme
} from "@mui/material";
import {
  StyledModal,
  ModalContent,
  ModalText
} from "./BlockedNamesModal-styles";
import {
  useDeleteListItemMutation,
  useLazyGetListItemsQuery
} from "../../../state/api/endpoints";

interface PostModalProps {
  open: boolean;
  onClose: () => void;
}

export const BlockedNamesModal: React.FC<PostModalProps> = ({
  open,
  onClose
}) => {
  const [blockedNames, setBlockedNames] = useState<string[]>([]);
  const theme = useTheme();
  const [fetchListItems] = useLazyGetListItemsQuery();
  const [deleteListItem] = useDeleteListItemMutation();
  const getBlockedNames = React.useCallback(async () => {
    try {
      const listName = `blockedNames`;
      const response = await fetchListItems({
        list_name: listName
      }).unwrap();
      setBlockedNames(Array.isArray(response) ? response : []);
    } catch (error) {
      onClose();
    }
  }, [fetchListItems, onClose]);

  React.useEffect(() => {
    getBlockedNames();
  }, [getBlockedNames]);

  const removeFromBlockList = async (name: string) => {
    try {
      const response = await deleteListItem({
        list_name: "blockedNames",
        item: name
      }).unwrap();

      if (response === true || response === 'true' || response === 'SUCCESS') {
        setBlockedNames((prev) => prev.filter((n) => n !== name));
      }
    } catch (error) {}
  };

  return (
    <StyledModal open={open} onClose={onClose}>
      <ModalContent>
        <ModalText>Manage blocked names</ModalText>
        <List
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            flex: "1",
            overflow: "auto"
          }}
        >
          {blockedNames.map((name, index) => (
            <ListItem
              key={name + index}
              sx={{
                display: "flex"
              }}
            >
              <Typography>{name}</Typography>
              <Button
                sx={{
                  backgroundColor: theme.palette.primary.light,
                  color: theme.palette.text.primary,
                  fontFamily: "Raleway"
                }}
                onClick={() => removeFromBlockList(name)}
              >
                Remove
              </Button>
            </ListItem>
          ))}
        </List>
        <Button variant="contained" color="primary" onClick={onClose}>
          Close
        </Button>
      </ModalContent>
    </StyledModal>
  );
};
