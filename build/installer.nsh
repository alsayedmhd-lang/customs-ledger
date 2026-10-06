!include "FileFunc.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var LedgerInstallerMutex
!endif

; Run before electron-builder's built-in duplicate-installer check.
!macro preInit
  !ifndef BUILD_UNINSTALLER
    System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\Ledger-Setup-com.atwcc.customsledger.sqlite") p.r0 ?e'
    Pop $1
    StrCpy $LedgerInstallerMutex $0
    ${If} $0 == 0
      MessageBox MB_OK|MB_ICONSTOP|MB_TOPMOST "تعذر بدء التثبيت بأمان. يرجى إعادة المحاولة. / Unable to start Ledger setup safely." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
    ${If} $1 == 183
      MessageBox MB_OK|MB_ICONINFORMATION|MB_TOPMOST "تثبيت Ledger جارٍ بالفعل، يرجى الانتظار حتى يكتمل. / Ledger setup is already running. Please wait for it to finish." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
    ; Windows closes the mutex handle automatically when this process exits.
  !endif
!macroend

!macro customInstall
  ${GetOptions} "$CMDLINE" "/LEDGER_INTERNAL_UPDATE=" $0

  ${If} $0 != ""
    FileOpen $1 "$INSTDIR\ledger-update-install-marker.json" w
    FileWrite $1 '{"type":"internal","token":"$0"}'
    FileClose $1
  ${Else}
    FileOpen $1 "$INSTDIR\ledger-update-install-marker.json" w
    FileWrite $1 '{"type":"external"}'
    FileClose $1
  ${EndIf}
!macroend
