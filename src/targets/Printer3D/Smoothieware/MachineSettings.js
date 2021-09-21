/*
 MachineSettings.js - ESP3D WebUI Target file

 Copyright (c) 2020 Luc Lebosse. All rights reserved.

 This code is free software; you can redistribute it and/or
 modify it under the terms of the GNU Lesser General Public
 License as published by the Free Software Foundation; either
 version 2.1 of the License, or (at your option) any later version.

 This code is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public
 License along with This code; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/
import { Fragment, h } from "preact";
import { useEffect, useState, useRef } from "preact/hooks";
import { T } from "../../../components/Translations";
import { processor } from "./processor";
import { useHttpFn } from "../../../hooks";
import { useUiContext, useUiContextFn } from "../../../contexts";
import { Target } from "./index";
import {
  espHttpURL,
  disableUI,
  formatFileSizeToString,
} from "../../../components/Helpers";
import {
  Field,
  Loading,
  ButtonImg,
  Progress,
} from "../../../components/Controls";
import { RefreshCcw, XCircle, Send, Flag } from "preact-feather";
import { CMD } from "./CMD-source";

const machineSettings = {};
machineSettings.cache = [];
machineSettings.override = [];
let configSelected = true;

const MachineSettings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(machineSettings.cache);
  const [collected, setCollected] = useState("0 B");
  const { createNewRequest, abortRequest } = useHttpFn;
  const { modals, toasts, uisettings } = useUiContext();
  const configTab = useRef();
  const overrideTab = useRef();
  const id = "Machine Tab";
  const sendSerialCmd = (cmd, updateUI) => {
    createNewRequest(
      espHttpURL("command", { cmd }).toString(),
      { method: "GET", echo: cmd },
      {
        onSuccess: (result) => {
          //Result is handled on ws so just do nothing
          if (updateUI) updateUI(result);
        },
        onFail: (error) => {
          console.log("Error:", error);
          setIsLoading(false);
          toasts.addToast({ content: error, type: "error" });
          processor.stopCatchResponse();
        },
      }
    );
  };

  const processCallBack = (data, total) => {
    setCollected(formatFileSizeToString(total));
  };

  const processFeedback = (feedback) => {
    if (feedback.status) {
      if (feedback.command == "config") {
        machineSettings.cache = CMD.command("formatConfig", feedback.content);
      }
      if (feedback.status == "error") {
        console.log("got error");
        toasts.addToast({
          content: T("S4"),
          type: "error",
        });
      }
    }
    setIsLoading(false);
  };

  const onCancel = (e) => {
    toasts.addToast({
      content: T("S175"),
      type: "error",
    });
    processor.stopCatchResponse();
    machineSettings.cache = [];
    setIsLoading(false);
  };

  const onRefresh = (e) => {
    //get command
    const response = CMD.command(
      "config",
      uisettings.getValue("configfilename")
    );
    //send query
    if (
      processor.startCatchResponse(
        "CMD",
        "config",
        processFeedback,
        null,
        processCallBack
      )
    ) {
      setCollected("O B");
      setIsLoading(true);
      sendSerialCmd(response.cmd);
    }
  };

  const sendCommand = (element, setvalidation, isOverride) => {
    console.log("Send ", element.value);

    sendSerialCmd(
      isOverride
        ? element.value.trim()
        : `config-set sd ${element.label} ${element.value}`,
      () => {
        element.initial = element.value;
        setvalidation(generateValidation(element));
      }
    );

    //TODO: Should answer be checked ?
  };

  const generateValidation = (fieldData) => {
    const validation = {
      message: <Flag size="1rem" />,
      valid: true,
      modified: true,
    };
    if (fieldData.type == "text") {
      if (fieldData.value == fieldData.initial) {
        fieldData.hasmodified = false;
      } else {
        fieldData.hasmodified = true;
      }
      //TODO: Use Regex for validation
    }
    if (!validation.valid) {
      validation.message = T("S42");
    }
    fieldData.haserror = !validation.valid;
    //setShowSave(checkSaveStatus());
    if (!fieldData.hasmodified && !fieldData.haserror) {
      validation.message = null;
      validation.valid = true;
      validation.modified = false;
    }
    return validation;
  };
  useEffect(() => {
    if (uisettings.getValue("autoload") && machineSettings.cache == "") {
      //load settings
      onRefresh();
    }
  }, []);

  return (
    <div class="container" style="max-width:600px">
      <h4 class="show-low title">{Target}</h4>
      <div class="m-2" />

      {isLoading && (
        <Fragment>
          <Loading class="m-2" />
          <div>{collected}</div>
          <ButtonImg
            donotdisable
            icon={<XCircle />}
            label={T("S28")}
            tooltip
            data-tooltip={T("S28")}
            onClick={onCancel}
          />
        </Fragment>
      )}
      {!isLoading && (
        <center>
          <div class="text-primary m-2">
            <div class="form-group">
              <label class="form-radio form-inline">
                <input
                  type="radio"
                  name="configtype"
                  checked={configSelected}
                  onclick={(e) => {
                    configSelected = true;
                    configTab.current.classList.remove("d-none");
                    //overrideTab.classList.add("d-none")
                  }}
                />
                <i class="form-icon"></i>{" "}
                {uisettings.getValue("configfilename")}
              </label>
              <label class="form-radio form-inline">
                <input
                  type="radio"
                  name="configtype"
                  checked={!configSelected}
                  onclick={(e) => {
                    configSelected = false;
                    configTab.current.classList.add("d-none");
                    //overrideTab.classList.remove("d-none")
                  }}
                />
                <i class="form-icon"></i>
                {T("SM1")}
              </label>
            </div>
          </div>
          <div ref={configTab} class={!configSelected ? "d-none" : ""}>
            {machineSettings.cache.length > 0 && (
              <div class="bordered ">
                {machineSettings.cache.map((element, index) => {
                  if (element.type == "comment")
                    return (
                      <div class="comment m-1 text-left">{element.value}</div>
                    );
                  if (element.type == "disabled")
                    return (
                      <div class="text-secondary m-1 text-left">
                        {element.value}
                      </div>
                    );
                  if (element.type == "help")
                    return (
                      <div
                        class="text-small text-gray text-italic text-left"
                        style={`margin-left:2rem;${
                          machineSettings.cache[index + 1]
                            ? machineSettings.cache[index + 1].type == "help"
                              ? ""
                              : "margin-bottom:1rem"
                            : "margin-bottom:1rem"
                        }`}
                      >
                        {element.value}
                      </div>
                    );

                  const [validation, setvalidation] = useState();
                  const button = (
                    <ButtonImg
                      className="submitBtn"
                      group
                      icon={<Send />}
                      label={T("S81")}
                      tooltip
                      data-tooltip={T("S82")}
                      onclick={() => {
                        sendCommand(element, setvalidation, false);
                      }}
                    />
                  );
                  return (
                    <div class="m-1">
                      <Field
                        style="max-width:10rem;"
                        inline
                        label={element.label}
                        type={element.type}
                        value={element.value}
                        setValue={(val, update = false) => {
                          if (!update) {
                            element.value = val;
                          }
                          setvalidation(generateValidation(element));
                        }}
                        validation={validation}
                        button={button}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div class="m-2" />
          <ButtonImg
            icon={<RefreshCcw />}
            label={T("S50")}
            tooltip
            data-tooltip={T("S23")}
            onClick={onRefresh}
          />
        </center>
      )}
    </div>
  );
};

export { MachineSettings };
