import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { BarbersService } from './barbers.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { AssignServicesDto } from './dto/assign-services.dto';
import { SetSchedulesDto } from './dto/set-schedules.dto';

@Controller('barbers')
export class BarbersController {
  constructor(private readonly barbersService: BarbersService) {}

  @Post()
  create(@Body() createBarberDto: CreateBarberDto) {
    return this.barbersService.create(createBarberDto);
  }

  @Get()
  findAll(@Query('active') active?: string) {
    const onlyActive = active === 'true';
    return this.barbersService.findAll(onlyActive);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.barbersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBarberDto: UpdateBarberDto,
  ) {
    return this.barbersService.update(id, updateBarberDto);
  }

  @Put(':id/services')
  assignServices(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignServicesDto: AssignServicesDto,
  ) {
    return this.barbersService.assignServices(id, assignServicesDto);
  }

  @Put(':id/schedules')
  setSchedules(
    @Param('id', ParseIntPipe) id: number,
    @Body() setSchedulesDto: SetSchedulesDto,
  ) {
    return this.barbersService.setSchedules(id, setSchedulesDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.barbersService.remove(id);
  }
}
