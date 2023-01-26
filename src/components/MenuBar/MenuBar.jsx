import React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import InfoIcon from "@mui/icons-material/Info";
import ChatIcon from "@mui/icons-material/Chat";
import EmailIcon from "@mui/icons-material/Email";
import Tooltip from "../DiscordComponents/DiscordTooltip/DiscordToolTip";
import MenuBarStyles from "./MenuBar.styles";
// import SickIcon from "@mui/icons-material/Sick";

const MenuBar = ({ menuIndex, setMenuIndex }) => {
  const classes = MenuBarStyles();

  const handleChange = (event, newValue) => {
    setMenuIndex(newValue);
  };

  return (
    <>
      <Tabs className={classes.tabs} value={menuIndex} onChange={handleChange}>
        <Tooltip arrow title="Channel Messages">
          <Tab icon={<ChatIcon />} />
        </Tooltip>
        <Tooltip arrow title="Direct Messages">
          <Tab icon={<EmailIcon />} />
        </Tooltip>
        {/* <Tooltip title="Nuke Account">
          <Tab disabled icon={<SickIcon />} />
        </Tooltip> */}
        <Tooltip arrow title="General Information">
          <Tab icon={<InfoIcon />} />
        </Tooltip>
      </Tabs>
    </>
  );
};

export default MenuBar;
