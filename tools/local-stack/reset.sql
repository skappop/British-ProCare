update containers set last_checked_at=null;
update container_items set missing_quantity=0, missing_since=null, current_quantity=baseline_quantity;
delete from stock_events;
update inventory i set last_counted_at=null, ordered_at=null, ordered_quantity=null, stock = v.s
  from (values ('Gloves (M)',12),('Cotton rolls',30),('Anaesthetic cartridge',60),('Composite A2',3),('Bonding agent',2),('Etching gel',4),('Mirror',6),('Probe',6),('K-file 25',5),('Gutta percha',1),('Paper points',8),('Saliva ejector',100),('Bracket kit',4),('Ortho wire 014',20)) v(n,s) where i.name=v.n;
