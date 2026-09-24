# Hybrid voice trial (personal use)

The app now records once with `AudioRecord`. When a Groq key is configured and
Android reports an active network, it sends a WAV of that utterance to Groq's
`whisper-large-v3` transcription endpoint. If the network call fails, returns
an error, or gives empty text, the same recording goes through the bundled
`ggml-base-q5_1.bin` Whisper model. With no key or no active network, the
recording stays on the phone. The output still goes to SANAD's existing expense
review screen; it is not automatically saved as a transaction.

## Configure on the phone

1. Create a personal Groq API key in the Groq console. Check the current Free
   Plan limits in that account before relying on them.
2. Install the test APK and open **Add > Voice > Online voice settings**.
3. Paste the key there, then tap the microphone to record. The app encrypts it with Android Keystore before saving
   it in private app preferences. The key never appears in the WebView or source.
4. To stop cloud processing, choose **Local only** in the same dialog.

The cloud request sends only the recorded audio to Groq. API keys entered into
one personal APK are suitable for this trial; a future public version needs a
server-side credential design rather than a shared key shipped in an APK.

## Validate on the Samsung S25 FE

Test one utterance while online and check Voice diagnostics for
`lastEngine=groq_whisper_large_v3`. Disable connectivity, repeat, and check
`lastEngine=local_whisper_base`. Test an invalid key or exhausted quota while
online; the app should show local fallback and still offer the result for
review. For each mode, verify amount, currency, merchant, and date before
saving. Repeat after closing and reopening the app.

Local automated checks run with `node qa/test-v36-critical.js`; the CI workflow
builds an isolated test APK. A physical-device test is still required to establish
microphone behavior, Arabic accuracy, cloud latency, and fallback timing.
