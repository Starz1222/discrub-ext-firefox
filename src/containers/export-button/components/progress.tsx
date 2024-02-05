import { Stack, CircularProgress, Typography } from "@mui/material";
import { useExportSlice } from "../../../features/export/use-export-slice";
import { useMessageSlice } from "../../../features/message/use-message-slice";

const Progress = () => {
  const { state: exportState } = useExportSlice();
  const name = exportState.name();
  const statusText = exportState.statusText();

  const { state: messageState } = useMessageSlice();
  const fetchProgress = messageState.fetchProgress();
  const lookupUserId = messageState.lookupUserId();
  const { messageCount, threadCount, parsingThreads } = fetchProgress || {};

  const getProgressText = (): string => {
    if (parsingThreads) {
      return `${threadCount} Threads Found`;
    } else if (!lookupUserId) {
      if (messageCount) {
        return `${messageCount} Messages Found`;
      } else {
        return "Processing";
      }
    } else if (lookupUserId) {
      return `User Lookup ${lookupUserId}`;
    } else {
      return "";
    }
  };

  return (
    <Stack
      direction="column"
      justifyContent="center"
      alignItems="center"
      spacing={2}
      sx={{ minWidth: "300px" }}
    >
      <Typography>{name}</Typography>
      <CircularProgress />
      <Typography variant="caption">
        {statusText || getProgressText()}
      </Typography>
    </Stack>
  );
};

export default Progress;
