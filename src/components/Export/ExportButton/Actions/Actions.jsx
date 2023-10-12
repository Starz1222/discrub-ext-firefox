import React, { useState, useContext, useRef } from "react";
import { Button, Menu, MenuItem, DialogActions } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ChannelContext } from "../../../../context/channel/ChannelContext";
import { MessageContext } from "../../../../context/message/MessageContext";
import ExportUtils from "../../ExportUtils";
import { DmContext } from "../../../../context/dm/DmContext";
import { GuildContext } from "../../../../context/guild/GuildContext";
import { ExportContext } from "../../../../context/export/ExportContext";
import { v4 as uuidv4 } from "uuid";
import { sortByProperty, wait } from "../../../../utils";
import PauseButton from "../../../PauseButton/PauseButton";

const Actions = ({ handleDialogClose, isDm, contentRef, bulk }) => {
  const {
    state: exportState,
    setName,
    setIsExporting,
    setStatusText,
    setIsGenerating,
    setCurrentPage,
    setMessagesPerPage,
  } = useContext(ExportContext);
  const {
    downloadImages,
    isExporting,
    currentPage,
    messagesPerPage,
    sortOverride,
  } = exportState;

  const {
    state: messageState,
    getMessageData,
    resetMessageData,
    checkDiscrubPaused,
  } = useContext(MessageContext);

  const { state: dmState } = useContext(DmContext);
  const {
    state: channelState,
    setChannel,
    resetChannel,
  } = useContext(ChannelContext);
  const { state: guildState } = useContext(GuildContext);
  const { messages: contextMessages, filteredMessages } = messageState;
  const { channels, selectedExportChannels, selectedChannel } = channelState;
  const { selectedDm } = dmState;
  const { selectedGuild } = guildState;
  const zipName = `${selectedDm.name || selectedGuild.name}`;
  const currentPageRef = useRef();
  currentPageRef.current = currentPage;
  const exportingActiveRef = useRef();
  exportingActiveRef.current = isExporting;
  const [anchorEl, setAnchorEl] = useState(null);
  const { addToZip, generateZip, resetZip, generateHTML, setExportMessages } =
    new ExportUtils(contentRef, setIsGenerating, zipName);
  const open = !!anchorEl;
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const isExportCancelled = () => !exportingActiveRef.current;

  const _getDownloadUrl = (entity) => {
    switch (entity.type) {
      case "gifv":
        return entity.video.proxy_url;
      case "image":
        return entity.thumbnail.proxy_url;
      case "video":
        return null; // We do not want to download video embeds
      default:
        return entity.proxy_url;
    }
  };

  const _downloadCollection = async (
    collection = [],
    collectionName = "",
    message = {},
    imgPath = ""
  ) => {
    for (let c2 = 0; c2 < collection.length; c2 += 1) {
      if (isExportCancelled()) break;
      await checkDiscrubPaused();
      try {
        const entity = message[collectionName][c2];
        const downloadUrl = _getDownloadUrl(entity);
        if (downloadUrl) {
          const blob = await fetch(downloadUrl).then((r) => r.blob());
          if (blob.size) {
            // TODO: We really should create Embed/Attachment getFileName functions instead of doing this
            let cleanFileName;
            if (entity.filename) {
              const fNameSplit = entity.filename.split(".");
              const fileExt = fNameSplit.pop();
              cleanFileName = `${fNameSplit.join(".")}_${uuidv4()}.${fileExt}`;
            } else {
              const blobType = blob.type?.split("/")?.[1];
              cleanFileName = `${
                entity.title ? `${entity.title}_` : ""
              }${uuidv4()}.${blobType}`;
            }
            await addToZip(blob, `${imgPath}/${cleanFileName}`);

            message[collectionName][c2] = Object.assign(
              message[collectionName][c2],
              { local_url: `${imgPath.split("/")[1]}/${cleanFileName}` }
            );
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const _processMessages = async (messages, imgPath) => {
    const processMessage = async (message) => {
      let updatedMessage = message;
      if (imgPath) {
        await _downloadCollection(
          updatedMessage.attachments,
          "attachments",
          updatedMessage,
          imgPath
        );
        await _downloadCollection(
          updatedMessage.embeds,
          "embeds",
          updatedMessage,
          imgPath
        );
      } else {
        updatedMessage.attachments = updatedMessage.attachments?.map(
          (attachment) => ({ ...attachment, local_url: null })
        );
      }
      return updatedMessage;
    };
    const retArr = [];
    for (let c1 = 0; c1 < messages.length; c1 += 1) {
      if (c1 === 0) {
        await wait(3);
      }
      if (isExportCancelled()) break;
      await checkDiscrubPaused();
      retArr.push(await processMessage(messages[c1]));
      if (c1 % 100 === 0) {
        setStatusText(
          `Processing - ${
            ((c1 / messages.length) * 100).toString().split(".")[0]
          }%`
        );
        await wait(0.1);
      }
    }

    return retArr;
  };
  const _compressMessages = async (
    updatedMessages,
    format,
    entityName,
    entityMainDirectory
  ) => {
    setStatusText(
      `Compressing${
        updatedMessages.length > 2000 ? " - This may take a while..." : ""
      }`
    );
    await wait(5);

    if (format === "json")
      return await addToZip(
        new Blob(
          [
            JSON.stringify(
              bulk
                ? updatedMessages.toSorted((a, b) =>
                    sortByProperty(
                      Object.assign(a, { date: new Date(a.timestamp) }),
                      Object.assign(b, { date: new Date(b.timestamp) }),
                      "date",
                      sortOverride
                    )
                  )
                : updatedMessages
            ),
          ],
          {
            type: "text/plain",
          }
        ),
        `${entityMainDirectory}/${entityName}.json`
      );
    else {
      const totalPages =
        updatedMessages.length > messagesPerPage
          ? Math.ceil(updatedMessages.length / messagesPerPage)
          : 1;
      while (currentPageRef.current <= totalPages && !isExportCancelled()) {
        await checkDiscrubPaused();
        setStatusText(
          `Compressing - Page ${currentPageRef.current} of ${totalPages}`
        );
        await wait(2);
        const startIndex =
          currentPageRef.current === 1
            ? 0
            : (currentPageRef.current - 1) * messagesPerPage;
        setExportMessages(
          updatedMessages?.slice(startIndex, startIndex + messagesPerPage)
        );
        const htmlBlob = await generateHTML();
        await addToZip(
          htmlBlob,
          `${entityMainDirectory}/${entityName}_page_${currentPageRef.current}.html`
        );
        await setCurrentPage(currentPageRef.current + 1);
      }
      return setCurrentPage(1);
    }
  };

  const handleExportSelected = async (format = "json") => {
    handleClose();
    const selectedChannels = isDm
      ? [selectedDm]
      : bulk
      ? channels.filter((c) => selectedExportChannels.some((id) => id === c.id))
      : [selectedChannel.id ? selectedChannel : selectedGuild];
    let count = 0;
    while (count < selectedChannels.length) {
      await setStatusText(null);
      const entity = selectedChannels[count];
      const entityMainDirectory = `${entity.name}_${uuidv4()}`;
      await setIsExporting(true);
      await setName(entity.name);
      if (bulk) !isDm && (await setChannel(entity.id));
      const { messages } = bulk
        ? await getMessageData()
        : {
            messages: filteredMessages.length
              ? filteredMessages
              : contextMessages,
          };

      const imgPath = downloadImages
        ? `${entityMainDirectory}/${entity.name}_images`
        : null;

      const updatedMessages = await _processMessages(messages, imgPath);

      if (messagesPerPage === null || messagesPerPage === 0)
        await setMessagesPerPage(updatedMessages.length);

      if (updatedMessages.length > 0) {
        if (isExportCancelled()) break;
        await checkDiscrubPaused();
        await _compressMessages(
          updatedMessages,
          format,
          entity.name,
          entityMainDirectory
        );
      }

      count += 1;
      if (isExportCancelled()) break;
      await checkDiscrubPaused();
    }
    await checkDiscrubPaused();
    if (!isExportCancelled()) {
      setStatusText("Preparing Archive");
      await generateZip();
      if (bulk) await resetChannel();
      if (bulk) await resetMessageData();
    }
    setIsGenerating(false);
    setIsExporting(false);
    setName("");
    await resetZip();
    setStatusText(null);
    setCurrentPage(1);
  };

  return (
    <DialogActions>
      <Button color="secondary" variant="contained" onClick={handleDialogClose}>
        Cancel
      </Button>
      <PauseButton disabled={!isExporting} />
      <Button
        disabled={
          isExporting || (bulk && !isDm && selectedExportChannels.length === 0)
        }
        variant="contained"
        disableElevation
        onClick={handleClick}
        endIcon={<KeyboardArrowDownIcon />}
      >
        Export
      </Button>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem dense onClick={() => handleExportSelected("html")}>
          HTML
        </MenuItem>
        <MenuItem dense onClick={() => handleExportSelected("json")}>
          JSON
        </MenuItem>
      </Menu>
    </DialogActions>
  );
};

export default Actions;
