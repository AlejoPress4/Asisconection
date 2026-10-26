import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'external_user', synchronize: false })
export class GlobalUserViewEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  username!: string;

  @Column({ type: 'varchar', length: 120 })
  email!: string;

  @Column({ type: 'varchar', length: 40 })
  rol!: string;
}
