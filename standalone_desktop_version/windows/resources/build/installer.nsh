; Extra uninstall steps for Sonion Companion (included by electron-builder's NSIS template).
;
; ${isUpdated} is set when this uninstaller runs as part of an upgrade: keep the
; "Start with Windows" entry and the user's data in that case.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; "Start with Windows" entry written by the app (app.setLoginItemSettings, name "SonionCompanion").
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SonionCompanion"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "SonionCompanion"

    ; Companions, layouts, settings and cached assets. Ask (default: keep); silent uninstalls keep them.
    ${ifNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete your companions, layouts and cached assets?$\r$\n$\r$\n$APPDATA\Sonion Companion$\r$\n$\r$\nChoose No to keep them for a future reinstall." IDNO sonionKeepData
        RMDir /r "$APPDATA\Sonion Companion"
      sonionKeepData:
    ${endIf}
  ${endIf}
!macroend
