import * as VKID from "@vkid/sdk";
import { useEffect } from "react";

const APP_ID = Number(import.meta.env.VITE_VK_ID_APP_ID);
const REDIRECT_URL = "https://task.app.amazi.pro/";

export const VkIdLogin = ({
  onError,
  onToken,
}: {
  onError: (message: string) => void;
  onToken: (accessToken: string) => void;
}) => {
  useEffect(() => {
    if (!Number.isSafeInteger(APP_ID) || APP_ID <= 0) {
      onError("Вход через VK ID пока не настроен.");
      return;
    }

    try {
      VKID.Config.init({
        app: APP_ID,
        redirectUrl: REDIRECT_URL,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: "email",
      });
      const widget = new VKID.FloatingOneTap();
      widget
        .render({ appName: "UTP Servise", showAlternativeLogin: true })
        .on(VKID.WidgetEvents.ERROR, () => onError("Не удалось выполнить вход через VK ID."))
        .on(VKID.FloatingOneTapInternalEvents.LOGIN_SUCCESS, (payload: VKID.AuthResponse) => {
          void VKID.Auth.exchangeCode(payload.code, payload.device_id)
            .then((token) => {
              if (!token.access_token) throw new Error("VK ID не вернул токен входа.");
              onToken(token.access_token);
              widget.close();
            })
            .catch((failure: unknown) => {
              onError(
                failure instanceof Error
                  ? failure.message
                  : "Не удалось выполнить вход через VK ID.",
              );
            });
        });
      return () => widget.close();
    } catch (failure) {
      onError(failure instanceof Error ? failure.message : "Не удалось загрузить VK ID.");
    }
  }, [onError, onToken]);

  return null;
};
