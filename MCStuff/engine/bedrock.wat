;; MCStuff's own bounded matcher for vanilla Java 1.21.11 / 26.3 bedrock_floor.
;; Integer operations intentionally preserve Java's int/long overflow and shifts.
;; The caller supplies a validated pattern and the world-seeded positional factory.
(module
  (memory (export "memory") 1 1)
  (global $lo (mut i64) (i64.const 0))
  (global $hi (mut i64) (i64.const 0))
  (global $known (mut i32) (i32.const 0))
  (global $orientations (mut i32) (i32.const 0))
  (global $layer (mut i32) (i32.const -61))
  (global $threshold (mut i32) (i32.const 0))
  (global $minX (mut i32) (i32.const 0))
  (global $minZ (mut i32) (i32.const 0))
  (global $width (mut i32) (i32.const 0))
  (global $found (export "found") (mut i32) (i32.const 0))

  (func (export "configure") (param $a i64) (param $b i64)
    (param $n i32) (param $rotations i32) (param $y i32) (param $cut i32)
    (param $x0 i32) (param $z0 i32) (param $w i32)
    (global.set $lo (local.get $a)) (global.set $hi (local.get $b))
    (global.set $known (local.get $n)) (global.set $orientations (local.get $rotations))
    (global.set $layer (local.get $y)) (global.set $threshold (local.get $cut))
    (global.set $minX (local.get $x0)) (global.set $minZ (local.get $z0))
    (global.set $width (local.get $w)))

  (func $sample (export "sample") (param $x i32) (param $y i32) (param $z i32) (result i32)
    (local $hash i64) (local $a i64) (local $b i64)
    (local.set $hash
      (i64.xor
        (i64.xor (i64.extend_i32_s (i32.mul (local.get $x) (i32.const 3129871)))
          (i64.mul (i64.extend_i32_s (local.get $z)) (i64.const 116129781)))
        (i64.extend_i32_s (local.get $y))))
    (local.set $hash
      (i64.shr_s
        (i64.add (i64.mul (i64.mul (local.get $hash) (local.get $hash)) (i64.const 42317861))
          (i64.mul (local.get $hash) (i64.const 11))) (i64.const 16)))
    (local.set $a (i64.xor (local.get $hash) (global.get $lo)))
    (local.set $b (global.get $hi))
    (if (i64.eqz (i64.or (local.get $a) (local.get $b)))
      (then (local.set $a (i64.const 0x9e3779b97f4a7c15))
            (local.set $b (i64.const 0x6a09e667f3bcc909))))
    (i32.wrap_i64
      (i64.shr_u
        (i64.add (i64.rotl (i64.add (local.get $a) (local.get $b)) (i64.const 17))
          (local.get $a)) (i64.const 40))))

  ;; Pattern records: dx, dz, expected boolean, starting at byte 1024.
  ;; Result records: world x, world z, orientation index, starting at byte 8192.
  ;; Each call is bounded; a cap hit returns early without pretending the area is complete.
  (func (export "scan") (param $start i32) (param $count i32) (param $cap i32) (result i32)
    (local $done i32) (local $index i32) (local $x i32) (local $z i32)
    (local $r i32) (local $cell i32) (local $ptr i32) (local $out i32)
    (global.set $found (i32.const 0))
    (block $finished
      (loop $positions
        (br_if $finished (i32.ge_u (local.get $done) (local.get $count)))
        (local.set $index (i32.add (local.get $start) (local.get $done)))
        (local.set $x (i32.add (global.get $minX) (i32.rem_u (local.get $index) (global.get $width))))
        (local.set $z (i32.add (global.get $minZ) (i32.div_u (local.get $index) (global.get $width))))
        (local.set $r (i32.const 0))
        (block $rotationsDone
          (loop $rotations
            (br_if $rotationsDone (i32.ge_u (local.get $r) (global.get $orientations)))
            (local.set $cell (i32.const 0))
            (block $mismatch
              (loop $cells
                (if (i32.ge_u (local.get $cell) (global.get $known))
                  (then
                    (local.set $out (i32.add (i32.const 8192) (i32.mul (global.get $found) (i32.const 12))))
                    (i32.store (local.get $out) (local.get $x))
                    (i32.store offset=4 (local.get $out) (local.get $z))
                    (i32.store offset=8 (local.get $out) (local.get $r))
                    (global.set $found (i32.add (global.get $found) (i32.const 1)))
                    (if (i32.ge_u (global.get $found) (local.get $cap))
                      (then (return (i32.add (local.get $done) (i32.const 1)))))
                    (br $mismatch)))
                (local.set $ptr
                  (i32.add (i32.const 1024)
                    (i32.mul (i32.add (i32.mul (local.get $r) (global.get $known)) (local.get $cell)) (i32.const 12))))
                (br_if $mismatch
                  (i32.ne
                    (i32.lt_u
                      (call $sample (i32.add (local.get $x) (i32.load (local.get $ptr)))
                        (global.get $layer) (i32.add (local.get $z) (i32.load offset=4 (local.get $ptr))))
                      (global.get $threshold))
                    (i32.load offset=8 (local.get $ptr))))
                (local.set $cell (i32.add (local.get $cell) (i32.const 1)))
                (br $cells)))
            (local.set $r (i32.add (local.get $r) (i32.const 1)))
            (br $rotations)))
        (local.set $done (i32.add (local.get $done) (i32.const 1)))
        (br $positions)))
    (local.get $done))
)
