package com.sanad.offline;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.util.*;

public class DatabaseHelper extends SQLiteOpenHelper {
    private static final String DB = "sanad.db";
    private static final int VER = 1;

    public DatabaseHelper(Context c) { super(c, DB, null, VER); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, currency TEXT NOT NULL, merchant TEXT, category TEXT, note TEXT, raw_text TEXT, source TEXT, confidence REAL, tx_time INTEGER, income INTEGER DEFAULT 0, created_at INTEGER)");
        db.execSQL("CREATE INDEX idx_tx_time ON transactions(tx_time)");
        db.execSQL("CREATE INDEX idx_merchant ON transactions(merchant)");
        db.execSQL("CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, tx_id INTEGER, action TEXT, detail TEXT, at INTEGER)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}

    public long insert(Transaction t) {
        ContentValues v = new ContentValues();
        v.put("amount", t.amount); v.put("currency", t.currency); v.put("merchant", t.merchant);
        v.put("category", t.category); v.put("note", t.note); v.put("raw_text", t.rawText);
        v.put("source", t.source); v.put("confidence", t.confidence); v.put("tx_time", t.txTime);
        v.put("income", t.income ? 1 : 0); v.put("created_at", System.currentTimeMillis());
        long id = getWritableDatabase().insert("transactions", null, v);
        audit(id, "insert", t.rawText);
        return id;
    }

    public void delete(long id) {
        audit(id, "delete", "undo");
        getWritableDatabase().delete("transactions", "id=?", new String[]{String.valueOf(id)});
    }

    public boolean isDuplicate(Transaction t, long windowMs) {
        long a = t.txTime - windowMs, b = t.txTime + windowMs;
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id FROM transactions WHERE ABS(amount-?)<0.001 AND currency=? AND tx_time BETWEEN ? AND ? AND (merchant=? OR (?='' AND merchant='')) LIMIT 1",
                new String[]{String.valueOf(t.amount), t.currency, String.valueOf(a), String.valueOf(b), t.merchant, t.merchant});
        boolean found = c.moveToFirst(); c.close(); return found;
    }

    public double monthSpend() {
        long start = monthStart(), end = nextMonthStart();
        Cursor c = getReadableDatabase().rawQuery("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE income=0 AND tx_time>=? AND tx_time<? AND currency='AED'", new String[]{String.valueOf(start),String.valueOf(end)});
        double v = c.moveToFirst() ? c.getDouble(0) : 0; c.close(); return v;
    }

    public double monthIncome() {
        long start = monthStart(), end = nextMonthStart();
        Cursor c = getReadableDatabase().rawQuery("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE income=1 AND tx_time>=? AND tx_time<? AND currency='AED'", new String[]{String.valueOf(start),String.valueOf(end)});
        double v = c.moveToFirst() ? c.getDouble(0) : 0; c.close(); return v;
    }

    public double spendForMerchantThisMonth(String merchant) {
        Cursor c = getReadableDatabase().rawQuery("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE income=0 AND tx_time>=? AND tx_time<? AND lower(merchant)=lower(?) AND currency='AED'", new String[]{String.valueOf(monthStart()),String.valueOf(nextMonthStart()),merchant});
        double v = c.moveToFirst() ? c.getDouble(0) : 0; c.close(); return v;
    }

    public String topCategoryThisMonth() {
        Cursor c = getReadableDatabase().rawQuery("SELECT category, SUM(amount) s FROM transactions WHERE income=0 AND tx_time>=? AND tx_time<? AND currency='AED' GROUP BY category ORDER BY s DESC LIMIT 1", new String[]{String.valueOf(monthStart()),String.valueOf(nextMonthStart())});
        String v = c.moveToFirst() ? c.getString(0) : "—"; c.close(); return v;
    }

    public List<Transaction> latest(int limit) {
        ArrayList<Transaction> out = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id,amount,currency,merchant,category,note,raw_text,source,confidence,tx_time,income FROM transactions ORDER BY tx_time DESC,id DESC LIMIT ?", new String[]{String.valueOf(limit)});
        while (c.moveToNext()) {
            Transaction t = new Transaction();
            t.id=c.getLong(0);t.amount=c.getDouble(1);t.currency=c.getString(2);t.merchant=nz(c.getString(3));t.category=nz(c.getString(4));t.note=nz(c.getString(5));t.rawText=nz(c.getString(6));t.source=nz(c.getString(7));t.confidence=c.getDouble(8);t.txTime=c.getLong(9);t.income=c.getInt(10)==1;
            out.add(t);
        }
        c.close(); return out;
    }

    public JSONArray exportJson() throws JSONException {
        JSONArray a = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery("SELECT id,amount,currency,merchant,category,note,raw_text,source,confidence,tx_time,income,created_at FROM transactions ORDER BY id", null);
        while(c.moveToNext()) {
            JSONObject o=new JSONObject();
            o.put("id",c.getLong(0));o.put("amount",c.getDouble(1));o.put("currency",c.getString(2));o.put("merchant",c.getString(3));o.put("category",c.getString(4));o.put("note",c.getString(5));o.put("rawText",c.getString(6));o.put("source",c.getString(7));o.put("confidence",c.getDouble(8));o.put("txTime",c.getLong(9));o.put("income",c.getInt(10)==1);o.put("createdAt",c.getLong(11));
            a.put(o);
        }
        c.close(); return a;
    }

    private void audit(long tx, String action, String detail) {
        ContentValues v=new ContentValues();v.put("tx_id",tx);v.put("action",action);v.put("detail",detail);v.put("at",System.currentTimeMillis());
        getWritableDatabase().insert("audit",null,v);
    }
    private static String nz(String s){return s==null?"":s;}
    private static long monthStart(){Calendar c=Calendar.getInstance();c.set(Calendar.DAY_OF_MONTH,1);c.set(Calendar.HOUR_OF_DAY,0);c.set(Calendar.MINUTE,0);c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);return c.getTimeInMillis();}
    private static long nextMonthStart(){Calendar c=Calendar.getInstance();c.set(Calendar.DAY_OF_MONTH,1);c.set(Calendar.HOUR_OF_DAY,0);c.set(Calendar.MINUTE,0);c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);c.add(Calendar.MONTH,1);return c.getTimeInMillis();}
}
