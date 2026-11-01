Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null

$message = if ($args[0]) { $args[0] } else { "TriVote Biometric Voter Verification - Touch your fingerprint sensor" }
$result = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($message)) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
Write-Output "RESULT:$result"
