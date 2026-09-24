import com.sanad.full.VoiceWav;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public final class TestVoiceWav {
    private static int u16(byte[] a,int i){ return (a[i]&255)|((a[i+1]&255)<<8); }
    private static long u32(byte[] a,int i){ return (u16(a,i)&65535L)|((u16(a,i+2)&65535L)<<16); }
    private static void check(boolean ok,String reason){ if(!ok) throw new AssertionError(reason); }
    public static void main(String[] args) throws Exception {
        byte[] pcm={0,0,(byte)255,127,0,(byte)128};
        byte[] wav=VoiceWav.encode(pcm,16000);
        check(wav.length==50,"WAV size");
        check(new String(wav,0,4,StandardCharsets.US_ASCII).equals("RIFF"),"RIFF");
        check(u32(wav,4)==42,"RIFF length");
        check(new String(wav,8,8,StandardCharsets.US_ASCII).equals("WAVEfmt "),"WAVE format");
        check(u16(wav,20)==1&&u16(wav,22)==1,"PCM mono");
        check(u32(wav,24)==16000&&u32(wav,28)==32000,"sample/byte rate");
        check(u16(wav,34)==16&&u32(wav,40)==pcm.length,"bits/data length");
        check(Arrays.equals(Arrays.copyOfRange(wav,44,wav.length),pcm),"PCM unchanged");
        try { VoiceWav.encode(new byte[]{1},16000); throw new AssertionError("odd PCM accepted"); }
        catch(IllegalArgumentException expected) {}
        System.out.println("PASS: voice WAV upload format");
    }
}
