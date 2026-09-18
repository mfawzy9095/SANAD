package com.sanad.full;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import java.util.*;

public final class SanadDatabase extends SQLiteOpenHelper {
    private static final String DB="sanad.db"; private static final int VER=2;
    public static final class PendingBank {
        public final String hash, raw; public final long postedAt;
        PendingBank(String h,String r,long t){ hash=h; raw=r; postedAt=t; }
    }
    public SanadDatabase(Context c){ super(c,DB,null,VER); try{ setWriteAheadLoggingEnabled(true); }catch(Exception ignored){} }
    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE app_state(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE seen_messages(hash TEXT PRIMARY KEY, seen_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE pending_bank(hash TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int o,int n){ if(o<2) db.execSQL("CREATE TABLE IF NOT EXISTS pending_bank(hash TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)"); }
    public synchronized void saveState(String json) throws Exception {
        ContentValues v=new ContentValues(); v.put("id",1); v.put("payload",CryptoStore.encrypt(json)); v.put("updated_at",System.currentTimeMillis());
        if(getWritableDatabase().insertWithOnConflict("app_state",null,v,SQLiteDatabase.CONFLICT_REPLACE)==-1) throw new SQLiteException("state write failed");
    }
    public synchronized String loadState() throws Exception {
        try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM app_state WHERE id=1",null)){ if(c.moveToFirst()) return CryptoStore.decrypt(c.getString(0)); }
        return null;
    }
    public synchronized void clearState(){ SQLiteDatabase db=getWritableDatabase(); db.delete("app_state",null,null); db.delete("seen_messages",null,null); db.delete("pending_bank",null,null); }
    public synchronized boolean enqueueBankIfFresh(String hash,String raw,long postedAt) throws Exception {
        String encrypted=CryptoStore.encrypt(raw); SQLiteDatabase db=getWritableDatabase(); db.beginTransaction();
        try{
            ContentValues seen=new ContentValues(); seen.put("hash",hash); seen.put("seen_at",System.currentTimeMillis());
            if(db.insertWithOnConflict("seen_messages",null,seen,SQLiteDatabase.CONFLICT_IGNORE)==-1) return false;
            ContentValues p=new ContentValues(); p.put("hash",hash); p.put("payload",encrypted); p.put("created_at",postedAt>0?postedAt:System.currentTimeMillis());
            if(db.insertWithOnConflict("pending_bank",null,p,SQLiteDatabase.CONFLICT_ABORT)==-1) throw new SQLiteException("pending bank write failed");
            db.execSQL("DELETE FROM seen_messages WHERE seen_at < ?",new Object[]{System.currentTimeMillis()-180L*86400000L});
            db.setTransactionSuccessful(); return true;
        } finally { db.endTransaction(); }
    }
    public synchronized List<PendingBank> listPending() throws Exception {
        ArrayList<PendingBank> out=new ArrayList<>();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT hash,payload,created_at FROM pending_bank ORDER BY created_at ASC",null)){
            while(c.moveToNext()){ String raw=CryptoStore.decrypt(c.getString(1)); if(raw!=null) out.add(new PendingBank(c.getString(0),raw,c.getLong(2))); }
        }
        return out;
    }
    public synchronized void ackPending(String hash){ getWritableDatabase().delete("pending_bank","hash=?",new String[]{hash}); }
}
