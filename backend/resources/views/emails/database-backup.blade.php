<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin:0; padding:24px; background:#f4f4f5; font-family: Arial, Helvetica, sans-serif; color:#111827;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:10px; padding:32px; border:1px solid #e5e7eb;">
    <p style="margin:0 0 4px; font-size:18px; font-weight:bold;">{{ $appName }}</p>
    <p style="margin:0 0 24px; font-size:13px; color:#6b7280;">Database Backup</p>

    @if($customMessage)
      <p style="font-size:14px; line-height:1.6; white-space:pre-wrap; margin:0 0 20px;">{{ $customMessage }}</p>
    @else
      <p style="font-size:14px; line-height:1.6; margin:0 0 20px;">
        Please find attached the database backup taken on <strong>{{ $backupDate }}</strong>.
      </p>
    @endif

    <table style="width:100%; border-top:1px solid #e5e7eb; padding-top:16px; margin-top:8px;">
      <tr>
        <td style="font-size:13px; color:#6b7280;">File</td>
        <td style="text-align:right; font-size:13px; font-weight:bold;">{{ $backupFilename }}</td>
      </tr>
      <tr>
        <td style="font-size:13px; color:#6b7280; padding-top:6px;">Size</td>
        <td style="text-align:right; font-size:13px; font-weight:bold; padding-top:6px;">{{ $backupSize }}</td>
      </tr>
    </table>

    <p style="font-size:12px; color:#9ca3af; margin-top:32px; margin-bottom:0;">
      This is a sensitive file containing your full application database — store and share it securely.
    </p>
  </div>
</body>
</html>
