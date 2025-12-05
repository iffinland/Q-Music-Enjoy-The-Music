import React, { useState } from "react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../ui/dialog";
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
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogTitle>Manage blocked names</DialogTitle>
        <DialogDescription>Remove names from your blocked list.</DialogDescription>
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-md border border-sky-800/50 bg-sky-950/40 p-3">
          {blockedNames.length === 0 && (
            <p className="text-sm text-sky-200/80">No blocked names.</p>
          )}
          {blockedNames.map((name) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-sky-900/50 px-3 py-2">
              <span className="text-sky-100">{name}</span>
              <Button variant="outline" size="sm" onClick={() => removeFromBlockList(name)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
