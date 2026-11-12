// Optional reference generator. Uses the owner's SHA1-verified vanilla server JAR.
// No Minecraft code or binaries are distributed with MCStuff.
// Run with JDK 25, the vanilla JAR + its bundled libraries on the classpath.
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

public final class BedrockReference {
  public static void main(String[] args) throws Exception {
    boolean mapped = args.length > 1 && args[1].equals("mapped");
    Class<?> source = Class.forName(mapped ? "net.minecraft.world.level.levelgen.XoroshiroRandomSource" : "evr");
    String forkName = mapped ? "forkPositional" : "e";
    String hashName = mapped ? "fromHashOf" : "a";
    String atName = mapped ? "at" : "a";
    String floatName = mapped ? "nextFloat" : "i";
    long[] seeds = {0,1,-1,12345,8711265447216421L,Long.MIN_VALUE,Long.MAX_VALUE};
    int[][] coordinates = {{0,0},{-1,-1},{686,687},{687,686},{1036,-966},{-8765,5303},{16777217,-16777219},{-29999984,29999974},{29999974,-29999984}};
    StringBuilder json = new StringBuilder("{\"version\":\"").append(mapped ? "26.3" : "1.21.11").append("\",\"seeds\":[");
    for (int s=0;s<seeds.length;s++) {
      Object root = source.getConstructor(long.class).newInstance(seeds[s]);
      Object positional = source.getMethod(forkName).invoke(root);
      Object named = positional.getClass().getMethod(hashName,String.class).invoke(positional,"minecraft:bedrock_floor");
      Object factory = source.getMethod(forkName).invoke(named);
      Field low = factory.getClass().getDeclaredField(mapped ? "seedLo" : "a");
      Field high = factory.getClass().getDeclaredField(mapped ? "seedHi" : "b");
      low.setAccessible(true); high.setAccessible(true);
      Method at = factory.getClass().getMethod(atName,int.class,int.class,int.class);
      Method nextFloat = source.getMethod(floatName);
      if (s>0) json.append(',');
      json.append("{\"seed\":\"").append(seeds[s]).append("\",\"factory\":[\"").append(low.getLong(factory)).append("\",\"").append(high.getLong(factory)).append("\"],\"samples\":[");
      boolean first=true;
      for (int[] coordinate:coordinates) for (int y=-63;y<=-60;y++) {
        float value = (float)nextFloat.invoke(at.invoke(factory,coordinate[0],y,coordinate[1]));
        if (!first) json.append(','); first=false;
        json.append('[').append(coordinate[0]).append(',').append(y).append(',').append(coordinate[1]).append(',').append((int)Math.scalb(value,24)).append(']');
      }
      json.append("],\"pattern\":{\"x\":1036,\"z\":-966,\"layer\":-61,\"rows\":[");
      for (int z=0;z<10;z++) {
        if (z>0) json.append(',');json.append('"');
        for (int x=0;x<10;x++) {
          float value=(float)nextFloat.invoke(at.invoke(factory,1036+x,-61,-966+z));
          json.append((double)value < 1.0-3.0/5.0 ? 'B' : 'O');
        }
        json.append('"');
      }
      json.append("]}}");
    }
    json.append("]}\n");
    Files.writeString(Path.of(args[0]),json.toString());
    System.out.println("Saved "+seeds.length*coordinates.length*4+" vanilla RNG samples and "+seeds.length+" patterns.");
  }
}
