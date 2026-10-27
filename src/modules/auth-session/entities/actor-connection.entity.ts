import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Actor } from './actor.entity';

export type ActorConnectionStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

@Entity({ name: 'actor_connections' })
@Unique('UQ_actor_connections_pair', ['requesterActorId', 'receiverActorId'])
@Index('IDX_actor_connections_requester', ['requesterActorId'])
@Index('IDX_actor_connections_receiver', ['receiverActorId'])
export class ActorConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'requester_actor_id', type: 'uuid' })
  requesterActorId!: string;

  @ManyToOne(() => Actor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_actor_id' })
  requesterActor!: Actor;

  @Column({ name: 'receiver_actor_id', type: 'uuid' })
  receiverActorId!: string;

  @ManyToOne(() => Actor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_actor_id' })
  receiverActor!: Actor;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: ActorConnectionStatus;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
}
