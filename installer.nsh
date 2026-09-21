!include "FileFunc.nsh"
!include "LogicLib.nsh"

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
